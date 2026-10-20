// A scripted bench test: drive the robot with the scripted operator, inject one
// fault at a time, and record what the system actually did.
import { HoldReason, Mode, dist, fromVec3, now, type V3 } from './wire';
import { MODE_LABEL, HOLD_LABEL, type Station } from './station';
import { NOMINAL } from './link';

export type CaseResult = {
  id: string;
  name: string;
  expected: string;
  reaction: string; // mode path, e.g. "Active → Hold → Active"
  detectMs: number | null; // fault applied -> robot left ACTIVE
  travelMm: number; // how far a hand moved after the robot reacted
  recovery: string;
  recoveryMs: number | null;
  note: string;
  pass: boolean;
};

type Ctx = { station: Station; sleep: (ms: number) => Promise<void> };
type Case = {
  id: string;
  name: string;
  expected: string;
  stops: boolean; // should the robot leave ACTIVE on its own?
  observeMs: number;
  goal?: { left: V3; right: V3 };
  useTask?: boolean;
  apply: (c: Ctx) => void;
  revert: (c: Ctx) => void;
  note?: (o: Observation) => string;
};

type Observation = { latencyP50: number; outboxMax: number; outboxAfter: number; holdsSeen: number };

export const CASES: Case[] = [
  {
    id: 'latency', name: '250 ms latency, ±40 ms jitter', expected: 'Keeps driving; the operator feels the lag', stops: false, observeMs: 4000,
    apply: c => c.station.setConditions({ latencyMs: 250, jitterMs: 40 }),
    revert: c => c.station.setConditions({ latencyMs: NOMINAL.latencyMs, jitterMs: NOMINAL.jitterMs }),
    note: o => `Command-to-video p50 ${Math.round(o.latencyP50)} ms`,
  },
  {
    id: 'loss', name: '20% packet loss', expected: 'Keeps driving; newer packets replace lost ones', stops: false, observeMs: 4000,
    apply: c => c.station.setConditions({ lossPct: 20 }),
    revert: c => c.station.setConditions({ lossPct: 0 }),
    note: o => `${o.holdsSeen} hold(s) during the window`,
  },
  {
    id: 'blip', name: 'Link cut for 0.4 s', expected: 'Holds within 150 ms, resumes by itself', stops: true, observeMs: 1200,
    apply: c => { c.station.setConditions({ down: true }); setTimeout(() => c.station.setConditions({ down: false }), 400); },
    revert: () => {},
  },
  {
    id: 'outage', name: 'Link cut for 3 s', expected: 'Holds, then retracts and disarms at 1.5 s', stops: true, observeMs: 3600,
    apply: c => c.station.setConditions({ down: true }),
    revert: c => c.station.setConditions({ down: false }),
  },
  {
    id: 'cam-dead', name: 'Head camera dies', expected: 'Stops: the operator is blind', stops: true, observeMs: 1500,
    apply: c => c.station.inject({ kind: 'camera_dead', camera: 'head', on: true }),
    revert: c => c.station.inject({ kind: 'camera_dead', camera: 'head', on: false }),
  },
  {
    id: 'cam-frozen', name: 'Head camera freezes (frames keep coming)', expected: 'Stops once the image fails to follow the robot', stops: true, observeMs: 2500,
    apply: c => c.station.inject({ kind: 'camera_frozen', camera: 'head', on: true }),
    revert: c => c.station.inject({ kind: 'camera_frozen', camera: 'head', on: false }),
  },
  {
    id: 'cam-workcell', name: 'Workcell camera dies', expected: 'Keeps driving with a warning', stops: false, observeMs: 1500,
    apply: c => c.station.inject({ kind: 'camera_dead', camera: 'workcell', on: true }),
    revert: c => c.station.inject({ kind: 'camera_dead', camera: 'workcell', on: false }),
  },
  {
    id: 'encoder', name: 'Left elbow encoder freezes', expected: 'Stops; refuses to clear until the encoder agrees', stops: true, observeMs: 2500,
    apply: c => c.station.inject({ kind: 'encoder_freeze', joint: 'left_elbow_joint', on: true }),
    revert: c => c.station.inject({ kind: 'encoder_freeze', joint: 'left_elbow_joint', on: false }),
  },
  {
    id: 'motor', name: 'Right shoulder motor loses 90% of its torque', expected: 'Stops on sustained torque saturation', stops: true, observeMs: 3500,
    goal: { left: [0.24, 0.2, 0.93], right: [0.46, -0.2, 1.02] },
    apply: c => c.station.inject({ kind: 'weak_motor', joint: 'right_shoulder_pitch_joint', on: true }),
    revert: c => c.station.inject({ kind: 'weak_motor', joint: 'right_shoulder_pitch_joint', on: false }),
  },
  {
    id: 'cloud', name: 'Control plane unreachable for 5 s', expected: 'Teleop unaffected; logs buffer on the robot', stops: false, observeMs: 5000, useTask: true,
    apply: c => c.station.setCloud(false),
    revert: c => c.station.setCloud(true),
    note: o => `${o.outboxMax} log(s) buffered, ${o.outboxAfter} left after reconnect`,
  },
];

export async function runSuite(station: Station, onProgress: (done: CaseResult[], running: string | null) => void, signal: AbortSignal): Promise<CaseResult[]> {
  const sleep = (ms: number) => new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
  const ctx: Ctx = { station, sleep };
  const results: CaseResult[] = [];
  const wasAutopilot = station.getSnapshot().autopilot;
  station.setAutopilot(false);
  if (station.getSnapshot().current) station.abortTask();
  station.setSuiteDriving(true);
  try {
    for (const c of CASES) {
      onProgress([...results], c.id);
      results.push(await runCase(ctx, c));
      onProgress([...results], null);
    }
  } finally {
    station.setSuiteDriving(false);
    station.setSuiteGoal(null);
    station.setConditions({ ...NOMINAL });
    station.setCloud(true);
    station.clearHarness();
    station.setAutopilot(wasAutopilot);
  }
  return results;
}

async function ensureActive({ station, sleep }: Ctx, timeoutMs: number): Promise<{ ok: boolean; actions: string[] }> {
  const t0 = now();
  const actions: string[] = [];
  let lastAction = 0;
  while (now() - t0 < timeoutMs) {
    const m = station.modeNow();
    if (m === Mode.ACTIVE && station.robotSilentMs() < 200) return { ok: true, actions };
    if (now() - lastAction > 600) {
      if (m === Mode.ESTOP) { station.clearEstop(); actions.push('clear E-stop'); lastAction = now(); }
      else if (m === Mode.FAULT) { station.ackFault(); actions.push('acknowledge'); lastAction = now(); }
      else if (m === Mode.DISARMED) { station.arm(); actions.push('re-arm'); lastAction = now(); }
    }
    await sleep(25);
  }
  return { ok: false, actions };
}

async function runCase(ctx: Ctx, c: Case): Promise<CaseResult> {
  const { station, sleep } = ctx;
  station.setSuiteGoal(c.goal ?? null);
  const ready = await ensureActive(ctx, 10_000);
  if (!ready.ok) return { id: c.id, name: c.name, expected: c.expected, reaction: 'Could not reach Active', detectMs: null, travelMm: 0, recovery: '—', recoveryMs: null, note: '', pass: false };
  await sleep(c.goal ? 1800 : 1200);
  if (c.useTask) station.startTask();

  const hands = () => { const s = station.stateNow(); return s ? { at: s.sentAtMs, left: fromVec3(s.leftHand), right: fromVec3(s.rightHand) } : null; };
  const samples: { at: number; left: V3; right: V3 }[] = [];
  const latencySamples: number[] = [];
  let outboxMax = 0;
  let lastSampleAt = 0;
  const t0 = now();
  c.apply(ctx);

  const observe = () => {
    const h = hands();
    if (h && h.at !== lastSampleAt) { samples.push(h); lastSampleAt = h.at; }
    outboxMax = Math.max(outboxMax, station.outboxNow());
    const lat = station.cmdToVideoNow();
    if (lat.length && now() - t0 < c.observeMs) latencySamples.push(lat[lat.length - 1]);
  };
  while (now() - t0 < c.observeMs) { observe(); await sleep(15); }
  const latencyP50 = median(latencySamples.slice(Math.floor(latencySamples.length / 3))); // skip the ramp

  c.revert(ctx);
  const r0 = now();
  let recovery = 'Automatic';
  let recoveryMs: number | null = null;
  // Give it a moment to recover on its own before acting like an operator.
  while (now() - r0 < 1500) {
    observe();
    if (station.modeNow() === Mode.ACTIVE && station.robotSilentMs() < 200) { recoveryMs = now() - r0; break; }
    await sleep(15);
  }
  if (recoveryMs === null) {
    const res = await ensureActive(ctx, 8000);
    recoveryMs = res.ok ? now() - r0 : null;
    recovery = res.ok ? `After ${[...new Set(res.actions)].join(', ')}` : 'Did not recover';
  }
  observe();
  await sleep(c.useTask ? 600 : 50);
  const outboxAfter = station.outboxNow();

  // What the robot did, from its own timestamped events (they survive outages).
  const events = station.modeEventsSince(t0).filter(e => e.atMs < r0 + 50);
  const holdsSeen = events.filter(e => e.mode === Mode.HOLD).length;
  const path: string[] = [MODE_LABEL[Mode.ACTIVE]];
  for (const e of events) {
    const lbl = MODE_LABEL[e.mode] + (e.mode === Mode.HOLD && e.holdReason !== HoldReason.NONE ? ` (${HOLD_LABEL[e.holdReason].toLowerCase()})` : '');
    if (path[path.length - 1] !== lbl) path.push(lbl);
  }
  const reacted = events.find(e => e.mode !== Mode.ACTIVE);
  const detectMs = reacted ? reacted.atMs - t0 : null;
  // Travel after the reaction: how far a hand moved once the robot had decided to stop.
  let travel = 0;
  if (reacted) {
    const before = [...samples].reverse().find(x => x.at <= reacted.atMs) ?? samples[0];
    // ...until it went back to driving, if it did.
    const resumed = events.find(e => e.atMs > reacted.atMs && e.mode === Mode.ACTIVE)?.atMs ?? r0;
    for (const x of samples) if (before && x.at > reacted.atMs && x.at < resumed) travel = Math.max(travel, dist(x.left, before.left), dist(x.right, before.right));
  }

  const pass = (c.stops ? reacted !== undefined : !path.some(p => p.startsWith('Fault') || p.startsWith('Safe') || p.startsWith('E-stop') || p.startsWith('Disarmed'))) && recoveryMs !== null;
  const reaction = path.length === 1 ? 'Stayed Active' : path.join(' → ');
  return {
    id: c.id, name: c.name, expected: c.expected, reaction,
    detectMs: c.stops ? detectMs : null, travelMm: travel * 1000, recovery: recovery === 'Automatic' && path.length === 1 ? 'Not needed' : recovery,
    recoveryMs, note: c.note?.({ latencyP50, outboxMax, outboxAfter, holdsSeen }) ?? '', pass,
  };
}

function median(v: number[]): number {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

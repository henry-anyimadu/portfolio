// The operator station: everything that runs on the operator's side of the
// network. It owns the input devices, the command stream, the view of robot
// state, the shift bookkeeping, and the link to the control plane.
//
// The robot agent runs in a worker and the two only meet through an emulated
// network (link.ts), so latency, jitter, loss and outages are real to both.
import { LinkDirection, NOMINAL, type LinkConditions } from './link';
import { OperatorInput, type InputSample } from './input';
import { spawnWorker } from './spawn-worker';
import {
  ControlKind, EventKind, FaultCode, HoldReason, Mode,
  decode, dist, encode, fromVec3, now, vec3,
  type StateFrame, type V3, type VideoFrame,
} from './wire';
import type { CameraId, EpisodeRecord, FromWorker, HarnessFault, RenderModel, ToWorker } from './types';

// ------------------------------------------------------------ public types

export type Severity = 'critical' | 'warning' | 'info' | 'ok';
export type Attention = { severity: Severity; title: string; detail: string; action?: { label: string; run: () => void } };

export type LogEntry = { at: number; kind: 'mode' | 'fault' | 'episode' | 'request' | 'link' | 'cloud' | 'note'; severity: Severity; text: string };

export type Task = { id: string; pad: string; hand: 'left' | 'right'; label: string };

export type TimeBucket = 'driving' | 'ready' | 'held' | 'stopped' | 'idle' | 'offline';

export type Snapshot = {
  phase: 'idle' | 'booting' | 'running' | 'error';
  bootStage: string;
  error: string;
  model: RenderModel | null;
  mode: Mode;
  holdReason: HoldReason;
  faults: FaultCode[];
  lastFaultDetail: string;
  robotSilentMs: number;
  state: StateFrame | null;
  input: InputSample;
  autopilot: boolean;
  conditions: LinkConditions;
  cloudUp: boolean;
  harness: HarnessFault[];
  attention: Attention;
  log: LogEntry[];
  tasks: Task[];
  current: { task: Task; startedAt: number } | null;
  done: (EpisodeRecord & { uploaded: boolean })[];
  cloudLogs: EpisodeRecord[];
  time: Record<TimeBucket, number>;
  metrics: Metrics;
  stuck: string | null;
};

export type Metrics = {
  rtt: Series;
  cmdToVideo: Series; // command sent -> first head-camera frame reflecting it
  frameAge: Record<CameraId, number>; // ms since the newest frame was captured
  fps: Record<CameraId, number>;
  stateLossPct: number;
  up: { sent: number; dropped: number; retransmits: number; kbps: number };
  down: { sent: number; dropped: number; retransmits: number; kbps: number };
  torqueMax: { left: number; right: number };
  simLoad: number;
};

export type Series = { values: number[]; p50: number; p95: number };

// --------------------------------------------------------------- constants

const COMMAND_HZ = 60;
const PING_HZ = 4;
const UI_HZ = 10;
const ROBOT_SILENT_MS = 400;
const CAMERA_STALE_MS = 300;
const CLOUD_LATENCY_MS = 90;
const STUCK_S = 12;

export const TASKS: Task[] = [
  { id: 't1', pad: 'pad_l1', hand: 'left', label: 'Left hand to the terracotta pad' },
  { id: 't2', pad: 'pad_r1', hand: 'right', label: 'Right hand to the olive pad' },
  { id: 't3', pad: 'pad_l2', hand: 'left', label: 'Left hand to the blue pad' },
  { id: 't4', pad: 'pad_r2', hand: 'right', label: 'Right hand to the ochre pad' },
  { id: 't5', pad: 'pad_c', hand: 'left', label: 'Left hand to the charcoal pad' },
  { id: 't6', pad: 'pad_c', hand: 'right', label: 'Right hand to the charcoal pad' },
];

export const MODE_LABEL: Record<Mode, string> = {
  [Mode.UNSPECIFIED]: 'Unknown', [Mode.BOOTING]: 'Booting', [Mode.DISARMED]: 'Disarmed', [Mode.ARMED]: 'Armed',
  [Mode.ACTIVE]: 'Active', [Mode.HOLD]: 'Hold', [Mode.SAFE_STOP]: 'Safe stop', [Mode.FAULT]: 'Fault', [Mode.ESTOP]: 'E-stop',
};

export const HOLD_LABEL: Record<HoldReason, string> = {
  [HoldReason.NONE]: '', [HoldReason.STALE_COMMANDS]: 'Commands stale', [HoldReason.DEADMAN_RELEASED]: 'Deadman released',
  [HoldReason.PRIMARY_CAMERA]: 'Primary camera', [HoldReason.TARGET_JUMP]: 'Target too far', [HoldReason.TORQUE_LIMIT]: 'Torque limit',
};

export const FAULT_LABEL: Record<FaultCode, string> = {
  [FaultCode.NONE]: '', [FaultCode.ENCODER_DISAGREE]: 'Encoder disagreement', [FaultCode.TORQUE_SATURATED]: 'Torque saturated',
  [FaultCode.CAMERA_LOST]: 'Camera lost', [FaultCode.CAMERA_FROZEN]: 'Camera frozen',
};

// ----------------------------------------------------------------- station

type Received = { frame: VideoFrame; arrivedAt: number };

export class Station {
  // Read by the renderer every animation frame, so kept outside React state.
  readonly frames: Record<CameraId, Received | null> = { head: null, workcell: null };
  readonly opTargets: { left: V3; right: V3 } = { left: [0.24, 0.2, 0.93], right: [0.24, -0.2, 0.93] };

  private worker: Worker | null = null;
  private up: LinkDirection | null = null;
  private down: LinkDirection | null = null;
  private input: OperatorInput | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private listeners = new Set<() => void>();
  private snap: Snapshot;

  private conditions: LinkConditions = { ...NOMINAL };
  private cloudUp = true;
  private harnessFaults = new Map<string, HarnessFault>();
  private autopilot = false;
  private suiteDriving = false;
  private suiteGoal: { left: V3; right: V3 } | null = null;

  private cmdSeq = 0;
  private reqId = 0;
  private pingSeq = 0;
  private cmdSentAt = new Map<number, number>();
  private lastCmdAccounted = 0;
  private state: StateFrame | null = null;
  private stateArrivedAt = 0;
  private lastStateSeq = 0;
  private stateGaps = { expected: 0, missing: 0 };
  private fpsCount: Record<CameraId, number[]> = { head: [], workcell: [] };
  private rtt: number[] = [];
  private cmdToVideo: number[] = [];
  private log: LogEntry[] = [];
  private modeEvents: { atMs: number; mode: Mode; holdReason: HoldReason }[] = [];
  private lastFaultDetail = '';
  private mode = Mode.BOOTING;
  private holdReason = HoldReason.NONE;
  private lastInput: InputSample = { deadman: false, left: [0, 0, 0], right: [0, 0, 0], source: 'none', estop: false };
  private lastTick = 0;
  private laneSnapshot = { at: 0, up: 0, down: 0, upKbps: 0, downKbps: 0 };

  private tasks: Task[] = [];
  private current: { task: Task; startedAt: number } | null = null;
  private done: (EpisodeRecord & { uploaded: boolean })[] = [];
  private cloudLogs: EpisodeRecord[] = [];
  private time: Record<TimeBucket, number> = { driving: 0, ready: 0, held: 0, stopped: 0, idle: 0, offline: 0 };
  private progress = { best: Infinity, since: 0 };
  private holdTimes: number[] = [];
  private stuck: string | null = null;
  private autoArmAt = 0;
  private nextAutoStart = 0;
  private autopilotPhase: { taskId: string; stage: 'approach' | 'descend' | 'retreat' } | null = null;

  constructor(private readonly assetBase = '/teleop') {
    this.tasks = TASKS.map(t => ({ ...t, id: `${t.id}-1` }));
    this.snap = this.buildSnapshot('idle', '', '', null);
  }

  // -------------------------------------------------------------- lifecycle

  private phase: Snapshot['phase'] = 'idle';
  private bootStage = '';
  private error = '';
  private model: RenderModel | null = null;

  start() {
    if (this.phase !== 'idle' && this.phase !== 'error') return;
    if (this.phase === 'error') this.teardown();
    this.phase = 'booting';
    this.bootStage = 'Starting the robot agent';
    this.error = '';
    this.emit();
    // Prebuilt by scripts/teleop/build-workers.mjs (runs before dev and build).
    const worker = spawnWorker(`${this.assetBase}/workers/agent.js`);
    this.worker = worker;
    this.up = new LinkDirection(() => this.conditions, (bytes, reliable) => this.toWorker({ t: 'net', bytes, reliable }));
    this.down = new LinkDirection(() => this.conditions, bytes => this.fromRobot(bytes));
    worker.onmessage = (e: MessageEvent<FromWorker>) => this.onWorker(e.data);
    worker.onerror = e => this.fail(e.message || 'The robot agent crashed.');
    worker.postMessage({ t: 'init', assetBase: this.assetBase });
    this.input = new OperatorInput(window);
    this.timers.push(setInterval(() => this.sendCommand(), 1000 / COMMAND_HZ));
    this.timers.push(setInterval(() => this.sendPing(), 1000 / PING_HZ));
    this.timers.push(setInterval(() => this.uiTick(), 1000 / UI_HZ));
  }

  dispose() {
    this.teardown();
    this.listeners.clear();
  }

  private teardown() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.up?.close();
    this.down?.close();
    this.input?.dispose();
    this.worker?.terminate();
    this.worker = null;
  }

  private fail(message: string) {
    this.phase = 'error';
    this.error = message;
    this.emit();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  private emit() {
    this.snap = this.buildSnapshot(this.phase, this.bootStage, this.error, this.model);
    for (const fn of this.listeners) fn();
  }

  // ----------------------------------------------------------------- worker

  private toWorker(m: ToWorker) {
    this.worker?.postMessage(m);
  }

  private onWorker(m: FromWorker) {
    switch (m.t) {
      case 'net': return this.down?.send(m.bytes, m.reliable);
      case 'boot': this.bootStage = m.stage; return this.emit();
      case 'error': return this.fail(m.message);
      case 'ready':
        this.model = m.model;
        this.phase = 'running';
        this.opTargets.left = [...m.model.rest.left];
        this.opTargets.right = [...m.model.rest.right];
        this.note('note', 'info', `Connected to ${m.model.agentVersion} (model ${m.model.modelHash}).`);
        this.toWorker({ t: 'cloud', up: this.cloudUp });
        return this.emit();
      case 'upload': return this.receiveUpload(m.records);
    }
  }

  // The robot's own uplink to the control plane. It does not share the
  // operator link: a cloud outage must not affect teleoperation, and vice versa.
  private receiveUpload(records: EpisodeRecord[]) {
    if (!this.cloudUp) return;
    setTimeout(() => {
      if (!this.cloudUp) return;
      for (const r of records) if (!this.cloudLogs.some(c => c.id === r.id)) this.cloudLogs.unshift(r);
      for (const d of this.done) {
        const r = records.find(x => x.id === d.id);
        if (r) Object.assign(d, r, { uploaded: true }); // the robot's record is the complete one
      }
      this.toWorker({ t: 'uploaded', ids: records.map(r => r.id) });
    }, CLOUD_LATENCY_MS);
  }

  // ------------------------------------------------------ robot -> station

  private fromRobot(bytes: Uint8Array) {
    const b = decode(bytes).body;
    const t = now();
    switch (b.case) {
      case 'state': {
        const s = b.value;
        if (s.seq <= this.lastStateSeq) return; // reordered by jitter: already have newer
        if (this.lastStateSeq) {
          this.stateGaps.expected += s.seq - this.lastStateSeq;
          this.stateGaps.missing += s.seq - this.lastStateSeq - 1;
        }
        this.lastStateSeq = s.seq;
        this.state = s;
        this.stateArrivedAt = t;
        this.mode = s.mode;
        this.holdReason = s.holdReason;
        // Outside ACTIVE, the operator's targets follow the robot. Resuming then
        // starts from where the robot is, never from a stale intention.
        if (s.mode !== Mode.ACTIVE) {
          this.opTargets.left = fromVec3(s.leftTarget);
          this.opTargets.right = fromVec3(s.rightTarget);
        }
        return;
      }
      case 'video': {
        const f = b.value;
        const cam = f.camera as CameraId;
        const prev = this.frames[cam];
        if (prev && prev.frame.frameSeq >= f.frameSeq) return;
        this.frames[cam] = { frame: f, arrivedAt: t };
        this.fpsCount[cam].push(t);
        if (cam === 'head' && f.lastCmdSeq > this.lastCmdAccounted) {
          const sent = this.cmdSentAt.get(f.lastCmdSeq);
          if (sent) push(this.cmdToVideo, t - sent, 300);
          for (const k of this.cmdSentAt.keys()) if (k <= f.lastCmdSeq) this.cmdSentAt.delete(k);
          this.lastCmdAccounted = f.lastCmdSeq;
        }
        return;
      }
      case 'pong':
        push(this.rtt, t - b.value.pingSentAtMs, 120);
        return;
      case 'event':
        return this.onEvent(b.value);
    }
  }

  private onEvent(e: { kind: EventKind; atMs: number; mode: Mode; holdReason: HoldReason; fault: FaultCode; message: string; episodeId: string; durationS: number; requestId: number }) {
    switch (e.kind) {
      case EventKind.MODE_CHANGED: {
        this.modeEvents.push({ atMs: e.atMs, mode: e.mode, holdReason: e.holdReason });
        if (this.modeEvents.length > 200) this.modeEvents.shift();
        const sev: Severity = e.mode === Mode.ESTOP || e.mode === Mode.FAULT || e.mode === Mode.SAFE_STOP ? 'critical' : e.mode === Mode.HOLD ? 'warning' : 'info';
        this.note('mode', sev, `${MODE_LABEL[e.mode]}. ${e.message}`);
        if (e.mode === Mode.HOLD) this.holdTimes.push(now());
        // Mode itself comes from state frames: events ride a different lane and can
        // arrive after newer state, so they must not move the mode backwards.
        if (e.mode === Mode.FAULT) this.lastFaultDetail = e.message;
        break;
      }
      case EventKind.FAULT_RAISED: this.lastFaultDetail = e.message; this.note('fault', 'critical', e.message); break;
      case EventKind.FAULT_CLEARED: this.note('fault', 'ok', capital(e.message)); break;
      case EventKind.REQUEST_REJECTED: this.note('request', 'warning', `Rejected: ${e.message}`); break;
      case EventKind.EPISODE_STARTED: this.note('episode', 'info', `Episode started: ${e.message}.`); break;
      case EventKind.EPISODE_SUCCEEDED:
      case EventKind.EPISODE_ABORTED: {
        const ok = e.kind === EventKind.EPISODE_SUCCEEDED;
        this.note('episode', ok ? 'ok' : 'warning', `${ok ? 'Done' : 'Aborted'} in ${e.durationS.toFixed(1)} s: ${e.message}.`);
        const task = this.current?.task;
        if (task && task.id === e.episodeId) {
          this.done.unshift({
            id: task.id, taskLabel: task.label, hand: task.hand, outcome: ok ? 'success' : 'aborted', durationS: e.durationS,
            holds: 0, faults: [], pathM: 0, endedAt: now(), agentVersion: this.model?.agentVersion ?? '', uploaded: false,
          });
          const cloud = this.cloudLogs.find(c => c.id === task.id);
          if (cloud) Object.assign(this.done[0], cloud, { uploaded: true });
          if (ok) this.tasks = this.tasks.filter(t => t.id !== task.id);
          this.current = null;
          this.nextAutoStart = now() + 1400;
          this.autopilotPhase = null;
          this.stuck = null;
          if (this.tasks.length < 3) this.refillTasks();
        }
        break;
      }
      case EventKind.LOG_UPLOADED: this.note('cloud', 'ok', e.message); break;
    }
    this.emit();
  }

  private refillTasks() {
    const round = Math.floor(this.done.length / TASKS.length) + 2;
    for (const t of TASKS) if (!this.tasks.some(x => x.pad === t.pad && x.hand === t.hand)) this.tasks.push({ ...t, id: `${t.id}-${round}-${Math.random().toString(36).slice(2, 6)}` });
  }

  // ------------------------------------------------------ station -> robot

  private sendCommand() {
    if (this.phase !== 'running') return;
    const t = now();
    const dt = this.lastTick ? Math.min(0.05, (t - this.lastTick) / 1000) : 0;
    this.lastTick = t;
    let inp = this.input?.sample() ?? this.lastInput;
    if (inp.estop) this.request(ControlKind.ESTOP);
    if (this.autopilot || this.suiteDriving) inp = this.autopilotInput(inp);
    this.lastInput = inp;

    if (this.mode === Mode.ACTIVE && inp.deadman) {
      for (const side of ['left', 'right'] as const) {
        const v = inp[side], p = this.opTargets[side];
        this.opTargets[side] = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
      }
    }
    const seq = ++this.cmdSeq;
    this.cmdSentAt.set(seq, t);
    if (this.cmdSentAt.size > 400) this.cmdSentAt.delete(this.cmdSentAt.keys().next().value!);
    this.up?.send(encode({
      body: { case: 'command', value: { seq, sentAtMs: t, deadman: inp.deadman, leftTarget: vec3(this.opTargets.left), rightTarget: vec3(this.opTargets.right) } },
    }), false);
  }

  private sendPing() {
    if (this.phase !== 'running') return;
    this.up?.send(encode({ body: { case: 'ping', value: { seq: ++this.pingSeq, sentAtMs: now() } } }), false);
  }

  request(kind: ControlKind, task?: Task) {
    if (this.phase !== 'running') return;
    this.up?.send(encode({ body: { case: 'control', value: { requestId: ++this.reqId, kind, task } } }), true);
    if (kind === ControlKind.ESTOP) this.note('request', 'critical', 'E-stop sent.');
  }

  arm = () => this.request(ControlKind.ARM);
  disarm = () => this.request(ControlKind.DISARM);
  estop = () => this.request(ControlKind.ESTOP);
  clearEstop = () => this.request(ControlKind.CLEAR_ESTOP);
  ackFault = () => this.request(ControlKind.ACK_FAULT);

  startTask = (task?: Task) => {
    const t = task ?? this.tasks[0];
    if (!t) return;
    this.current = { task: t, startedAt: now() };
    this.progress = { best: Infinity, since: now() };
    this.stuck = null;
    this.holdTimes = [];
    this.request(ControlKind.START_EPISODE, t);
    this.emit();
  };

  abortTask = () => {
    this.request(ControlKind.ABORT_EPISODE);
  };

  // ------------------------------------------------- conditions and harness

  setConditions(c: Partial<LinkConditions>) {
    const before = this.conditions;
    this.conditions = { ...this.conditions, ...c };
    if (c.down !== undefined && c.down !== before.down) this.note('link', c.down ? 'critical' : 'ok', c.down ? 'Operator link cut.' : 'Operator link restored.');
    this.emit();
  }

  setCloud(up: boolean) {
    if (up === this.cloudUp) return;
    this.cloudUp = up;
    this.toWorker({ t: 'cloud', up });
    this.note('cloud', up ? 'ok' : 'warning', up ? 'Control plane reachable.' : 'Control plane unreachable. Teleop continues; the robot buffers episode logs.');
    this.emit();
  }

  inject(f: HarnessFault) {
    const key = f.kind + ('camera' in f ? f.camera : f.joint);
    if (f.on) this.harnessFaults.set(key, f);
    else this.harnessFaults.delete(key);
    this.toWorker({ t: 'harness', fault: f });
    this.note('note', f.on ? 'warning' : 'info', `Bench harness: ${describeFault(f)} ${f.on ? 'injected' : 'removed'}.`);
    this.emit();
  }

  clearHarness() {
    for (const f of this.harnessFaults.values()) this.inject({ ...f, on: false });
  }

  setAutopilot(on: boolean) {
    this.autopilot = on;
    this.autopilotPhase = null;
    this.emit();
  }

  /** Used by the fault suite: drive with the scripted operator without showing autopilot as on. */
  setSuiteDriving(on: boolean) {
    this.suiteDriving = on;
    this.autopilotPhase = null;
  }

  setSuiteGoal(goal: { left: V3; right: V3 } | null) {
    this.suiteGoal = goal;
  }

  conditionsNow() { return this.conditions; }
  stateNow() { return this.state; }
  modeNow() { return this.mode; }
  rttNow() { return this.rtt; }
  cmdToVideoNow() { return this.cmdToVideo; }
  robotSilentMs() { return this.stateArrivedAt ? now() - this.stateArrivedAt : Infinity; }
  outboxNow() { return this.state?.outbox ?? 0; }
  /** Mode changes as the robot timestamped them. Reliable lane: late during an outage, never missing. */
  modeEventsSince(t: number) { return this.modeEvents.filter(e => e.atMs >= t); }

  // ------------------------------------------------- the scripted operator

  // Drives like a careful human: hover over the pad, descend, hold, retreat.
  private autopilotInput(human: InputSample): InputSample {
    const out: InputSample = { deadman: true, left: [0, 0, 0], right: [0, 0, 0], source: human.source, estop: human.estop };
    if (this.mode === Mode.DISARMED && this.autopilot && now() > this.autoArmAt) {
      this.autoArmAt = now() + 2500;
      this.arm();
    }
    if (!this.current && this.tasks.length && (this.mode === Mode.ACTIVE || this.mode === Mode.ARMED) && this.autopilot && now() > this.nextAutoStart) this.startTask();
    const pad = this.current && this.model?.pads.find(p => p.name === this.current!.task.pad);
    const hand = this.current?.task.hand;
    const speed = 0.13;
    const toward = (from: V3, to: V3, max: number): V3 => {
      const d = dist(from, to);
      if (d < 1e-4) return [0, 0, 0];
      const s = Math.min(max, d * 4) / d; // ease in on arrival
      return [(to[0] - from[0]) * s, (to[1] - from[1]) * s, (to[2] - from[2]) * s];
    };
    const rest = this.model?.rest;
    if (pad && hand && rest) {
      const ph = (this.autopilotPhase ??= { taskId: this.current!.task.id, stage: 'approach' });
      const above: V3 = [pad.pos[0], pad.pos[1], pad.pos[2] + 0.09];
      const at = this.opTargets[hand];
      if (ph.stage === 'approach' && dist(at, above) < 0.012) ph.stage = 'descend';
      const goal = ph.stage === 'approach' ? above : pad.pos;
      out[hand] = toward(at, goal, speed);
      const other = hand === 'left' ? 'right' : 'left';
      out[other] = toward(this.opTargets[other], rest[other], speed);
    } else if (this.suiteDriving && this.suiteGoal) {
      out.left = toward(this.opTargets.left, this.suiteGoal.left, speed);
      out.right = toward(this.opTargets.right, this.suiteGoal.right, speed);
    } else if (rest && this.suiteDriving) {
      // No task: sweep gently so faults that need motion show up.
      const tt = now() / 1000;
      const goalL: V3 = [0.32 + 0.06 * Math.sin(tt * 1.3), 0.2 + 0.05 * Math.cos(tt * 0.9), 0.97 + 0.04 * Math.sin(tt * 1.7)];
      const goalR: V3 = [0.32 + 0.06 * Math.cos(tt * 1.1), -0.2 + 0.05 * Math.sin(tt * 1.4), 0.97 + 0.04 * Math.cos(tt * 1.5)];
      out.left = toward(this.opTargets.left, goalL, speed);
      out.right = toward(this.opTargets.right, goalR, speed);
    } else if (rest) {
      out.left = toward(this.opTargets.left, rest.left, speed);
      out.right = toward(this.opTargets.right, rest.right, speed);
    }
    return out;
  }

  // ---------------------------------------------------------- bookkeeping

  private uiTick() {
    const t = now();
    if (this.phase === 'running') {
      const silent = this.robotSilentMs();
      const bucket: TimeBucket = silent > ROBOT_SILENT_MS ? 'offline'
        : this.mode === Mode.ACTIVE ? 'driving'
        : this.mode === Mode.ARMED ? 'ready'
        : this.mode === Mode.HOLD ? 'held'
        : this.mode === Mode.DISARMED ? 'idle' : 'stopped';
      if (this.current || this.autopilot) this.time[bucket] += 1000 / UI_HZ;
      this.updateStuck(t);
    }
    for (const id of ['head', 'workcell'] as const) this.fpsCount[id] = this.fpsCount[id].filter(x => x > t - 1000);
    this.emit();
  }

  private updateStuck(t: number) {
    const s = this.state;
    if (!this.current || !s || !s.episodeId) { this.stuck = null; return; }
    if (s.episodeDistM < this.progress.best - 0.01) this.progress = { best: s.episodeDistM, since: t };
    this.holdTimes = this.holdTimes.filter(x => x > t - 30_000);
    const noProgress = (t - this.progress.since) / 1000;
    if (this.holdTimes.length >= 3) this.stuck = `${this.holdTimes.length} holds in the last 30 s. Something in the setup is fighting the operator.`;
    else if (noProgress > STUCK_S && this.mode !== Mode.FAULT && this.mode !== Mode.ESTOP) this.stuck = `No progress toward the pad for ${noProgress.toFixed(0)} s.`;
    else this.stuck = null;
  }

  private note(kind: LogEntry['kind'], severity: Severity, text: string) {
    this.log.unshift({ at: now(), kind, severity, text });
    if (this.log.length > 80) this.log.length = 80;
  }

  private lanes() {
    const t = now();
    const u = this.up, d = this.down;
    const upBytes = (u?.unreliableStats.bytes ?? 0) + (u?.reliableStats.bytes ?? 0);
    const downBytes = (d?.unreliableStats.bytes ?? 0) + (d?.reliableStats.bytes ?? 0);
    const ls = this.laneSnapshot;
    if (t - ls.at > 1000) {
      const secs = (t - ls.at) / 1000;
      if (ls.at) { ls.upKbps = ((upBytes - ls.up) * 8) / 1000 / secs; ls.downKbps = ((downBytes - ls.down) * 8) / 1000 / secs; }
      ls.at = t; ls.up = upBytes; ls.down = downBytes;
    }
    const sum = (dir: LinkDirection | null, kbps: number) => ({
      sent: (dir?.unreliableStats.sent ?? 0) + (dir?.reliableStats.sent ?? 0),
      dropped: dir?.unreliableStats.dropped ?? 0,
      retransmits: dir?.reliableStats.retransmits ?? 0,
      kbps,
    });
    return { up: sum(u, ls.upKbps), down: sum(d, ls.downKbps) };
  }

  private buildSnapshot(phase: Snapshot['phase'], bootStage: string, error: string, model: RenderModel | null): Snapshot {
    const t = now();
    const s = this.state;
    const tf = s?.torqueFrac ?? [];
    const names = model?.actuators ?? [];
    const armMax = (side: string) => tf.reduce((m, v, i) => (names[i]?.startsWith(side) && !/hip|knee|ankle/.test(names[i]) ? Math.max(m, v) : m), 0);
    const frameAge = (c: CameraId) => (this.frames[c] ? t - this.frames[c]!.frame.captureAtMs : Infinity);
    const lanes = this.lanes();
    const snap: Snapshot = {
      phase, bootStage, error, model,
      mode: this.mode, holdReason: this.holdReason,
      faults: s?.faults ?? [],
      lastFaultDetail: this.lastFaultDetail,
      robotSilentMs: this.robotSilentMs(),
      state: s,
      input: this.lastInput,
      autopilot: this.autopilot,
      conditions: { ...this.conditions },
      cloudUp: this.cloudUp,
      harness: [...this.harnessFaults.values()],
      attention: { severity: 'info', title: '', detail: '' },
      log: this.log.slice(0, 40),
      tasks: [...this.tasks],
      current: this.current,
      done: this.done.slice(0, 30),
      cloudLogs: this.cloudLogs.slice(0, 30),
      time: { ...this.time },
      metrics: {
        rtt: series(this.rtt),
        cmdToVideo: series(this.cmdToVideo),
        frameAge: { head: frameAge('head'), workcell: frameAge('workcell') },
        fps: { head: this.fpsCount.head.length, workcell: this.fpsCount.workcell.length },
        stateLossPct: this.stateGaps.expected ? (100 * this.stateGaps.missing) / this.stateGaps.expected : 0,
        up: lanes.up, down: lanes.down,
        torqueMax: { left: armMax('left'), right: armMax('right') },
        simLoad: s?.simLoad ?? 0,
      },
      stuck: this.stuck,
    };
    snap.attention = this.attention(snap);
    return snap;
  }

  // One thing at a time: the most important fact about the cell right now.
  private attention(s: Snapshot): Attention {
    if (s.phase === 'idle') return { severity: 'info', title: 'Session not started', detail: 'Start a session to boot the robot agent and connect.' };
    if (s.phase === 'booting') return { severity: 'info', title: 'Connecting', detail: s.bootStage };
    if (s.phase === 'error') return { severity: 'critical', title: 'Could not start the robot agent', detail: s.error };
    if (!Number.isFinite(s.robotSilentMs)) return { severity: 'info', title: 'Connecting', detail: 'Agent started. Waiting for the first state frame from the robot.' };
    if (s.robotSilentMs > ROBOT_SILENT_MS) {
      const secs = (s.robotSilentMs / 1000).toFixed(1);
      return { severity: 'critical', title: `No data from the robot for ${secs} s`, detail: 'The robot holds on its own after 150 ms without commands and retracts after 1.5 s. Nothing you send right now will arrive.' };
    }
    switch (s.mode) {
      case Mode.ESTOP:
        return { severity: 'critical', title: 'E-stop latched', detail: 'The robot is frozen in place. Clear it when the cell is safe, then arm again.', action: { label: 'Clear E-stop', run: this.clearEstop } };
      case Mode.FAULT: {
        const service = s.faults.includes(FaultCode.ENCODER_DISAGREE);
        return {
          severity: 'critical', title: service ? 'Fault: needs service' : 'Fault: robot stopped',
          detail: s.lastFaultDetail + (service ? ' The robot will not move until the encoder agrees again. Call fleet support.' : ' Check the cell, then acknowledge to arm again.'),
          action: service ? undefined : { label: 'Acknowledge', run: this.ackFault },
        };
      }
      case Mode.SAFE_STOP:
        return { severity: 'critical', title: 'Safe stop: arms retracting', detail: 'The robot lost commands for too long and is parking itself. Arm again once it is disarmed.' };
      case Mode.HOLD: {
        const why = s.holdReason === HoldReason.STALE_COMMANDS
          ? `Commands are reaching the robot late (${Math.round(s.state?.cmdAgeMs ?? 0)} ms old). It is holding still until they are fresh again.`
          : s.holdReason === HoldReason.TARGET_JUMP ? 'Your target is far from the hand. Let go of the deadman to resync, then drive again.'
          : HOLD_LABEL[s.holdReason];
        return { severity: 'warning', title: 'Holding position', detail: why };
      }
    }
    if (s.metrics.frameAge.head > CAMERA_STALE_MS && s.mode === Mode.ACTIVE)
      return { severity: 'warning', title: `Head camera image is ${(s.metrics.frameAge.head / 1000).toFixed(1)} s old`, detail: 'Do not trust the main view until it updates.' };
    if (s.stuck) return { severity: 'warning', title: 'Looks stuck', detail: `${s.stuck} Abort and move on, or flag the task.`, action: { label: 'Abort episode', run: this.abortTask } };
    if (s.mode === Mode.DISARMED) return { severity: 'info', title: 'Robot disarmed', detail: 'Arm the robot to start driving.', action: { label: 'Arm', run: this.arm } };
    const acked = s.faults.filter(f => f !== FaultCode.NONE);
    if (acked.length) return { severity: 'warning', title: 'Driving with a known issue', detail: `${acked.map(f => FAULT_LABEL[f]).join(', ')} still active.` };
    if (!s.current) return s.tasks.length
      ? { severity: 'info', title: 'Ready for the next episode', detail: s.tasks[0].label + '.', action: { label: 'Start episode', run: () => this.startTask() } }
      : { severity: 'ok', title: 'Queue empty', detail: 'All tasks done.' };
    const d = s.state?.episodeDistM ?? 0;
    if (s.mode === Mode.ARMED) return { severity: 'info', title: s.current.task.label, detail: `Hold Space or your pedal to drive. ${(d * 100).toFixed(0)} cm to go.` };
    return { severity: 'ok', title: s.current.task.label, detail: `${(d * 100).toFixed(0)} cm to go.` };
  }
}

// ----------------------------------------------------------------- helpers

function push(arr: number[], v: number, max: number) {
  arr.push(v);
  if (arr.length > max) arr.shift();
}

function series(values: number[]): Series {
  if (!values.length) return { values: [], p50: NaN, p95: NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { values: values.slice(-120), p50: q(0.5), p95: q(0.95) };
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function describeFault(f: HarnessFault): string {
  switch (f.kind) {
    case 'camera_dead': return `${f.camera} camera dead`;
    case 'camera_frozen': return `${f.camera} camera frozen`;
    case 'encoder_freeze': return `${f.joint.replace(/_joint$/, '').replaceAll('_', ' ')} encoder frozen`;
    case 'weak_motor': return `${f.joint.replace(/_joint$/, '').replaceAll('_', ' ')} motor weakened`;
  }
}

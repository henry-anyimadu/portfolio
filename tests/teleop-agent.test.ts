// Real-time tests of the robot agent's safety behaviour, against the real G1 model.
// Run: npx tsx tests/teleop-agent.test.ts
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import load from '@mujoco/mujoco';
import { compileBundle, parseBundle } from '../lib/teleop/agent/bundle';
import { RobotAgent, LIMITS } from '../lib/teleop/agent/robot-agent';
import { ControlKind, EventKind, FaultCode, Mode, decode, encode, fromVec3, now, vec3, type V3 } from '../lib/teleop/wire';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const buf = readFileSync(new URL('../public/teleop/g1_workcell.bin', import.meta.url));
const mj = await load();
const bundle = parseBundle(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

type Rig = Awaited<ReturnType<typeof rig>>;
async function rig() {
  const model = compileBundle(mj, bundle);
  const events: { kind: EventKind; mode: Mode; message: string; at: number }[] = [];
  let state: ReturnType<typeof decode>['body'] | null = null;
  const agent = new RobotAgent(mj, model, bytes => {
    const b = decode(bytes).body;
    if (b.case === 'event') events.push({ kind: b.value.kind, mode: b.value.mode, message: b.value.message, at: b.value.atMs });
    if (b.case === 'state') state = b;
  }, () => {});
  const loop = setInterval(() => agent.tick(), 4);
  let seq = 0, req = 0;
  const op = { deadman: false, left: [0, 0, 0] as V3, right: [0, 0, 0] as V3, streaming: true };
  const cmdLoop = setInterval(() => {
    if (!op.streaming) return;
    agent.receive(encode({ body: { case: 'command', value: { seq: ++seq, sentAtMs: now(), deadman: op.deadman, leftTarget: vec3(op.left), rightTarget: vec3(op.right) } } }));
  }, 16);
  const control = (kind: ControlKind, task?: { id: string; pad: string; hand: string; label: string }) =>
    agent.receive(encode({ body: { case: 'control', value: { requestId: ++req, kind, task } } }));
  const st = () => {
    const s = state as unknown as { case: 'state'; value: { leftTarget: never; rightTarget: never; faults: FaultCode[]; mode: Mode } } | null;
    return s?.value;
  };
  const syncTargets = () => {
    const s = (state as any)?.value;
    op.left = fromVec3(s.leftTarget); op.right = fromVec3(s.rightTarget);
  };
  const stop = () => { clearInterval(loop); clearInterval(cmdLoop); };
  return { agent, events, op, control, st, syncTargets, stop, mode: () => agent.mode };
}

async function until(r: Rig, pred: () => boolean, timeoutMs: number, what: string) {
  const t0 = now();
  while (!pred()) {
    if (now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what} (mode ${Mode[r.mode()]})`);
    await sleep(5);
  }
  return now() - t0;
}

async function armAndDrive(r: Rig) {
  await sleep(100);
  r.control(ControlKind.ARM);
  await until(r, () => r.mode() === Mode.ARMED, 500, 'ARMED');
  await sleep(60);
  r.syncTargets();
  r.op.deadman = true;
  await until(r, () => r.mode() === Mode.ACTIVE, 500, 'ACTIVE');
}

const tests: [string, (r: Rig) => Promise<void>][] = [
  ['drives a hand to a pad and completes the episode', async r => {
    await armAndDrive(r);
    r.control(ControlKind.START_EPISODE, { id: 'ep-1', pad: 'pad_l1', hand: 'left', label: 'Touch the left pad' });
    r.op.left = [0.30, 0.20, 0.83];
    await until(r, () => r.events.some(e => e.kind === EventKind.EPISODE_SUCCEEDED), 6000, 'episode success');
    assert.equal(r.mode(), Mode.ACTIVE);
  }],
  ['holds within the stale window when commands stop, then safe-stops', async r => {
    await armAndDrive(r);
    r.op.streaming = false;
    const tHold = await until(r, () => r.mode() === Mode.HOLD, 1000, 'HOLD');
    assert.ok(tHold < LIMITS.staleMs + 60, `hold after ${tHold.toFixed(0)} ms`);
    await until(r, () => r.mode() === Mode.DISARMED, 6000, 'DISARMED');
    const hold = r.events.find(e => e.mode === Mode.HOLD)!, stopped = r.events.find(e => e.mode === Mode.SAFE_STOP)!;
    assert.ok(stopped, 'went through SAFE_STOP');
    const gap = stopped.at - hold.at;
    assert.ok(gap > LIMITS.safeStopMs - LIMITS.staleMs - 40 && gap < LIMITS.safeStopMs, `safe stop ${gap.toFixed(0)} ms after hold`);
    console.log(`     hold after ${tHold.toFixed(0)} ms, safe stop ${(tHold + gap).toFixed(0)} ms after the last command`);
  }],
  ['resumes after a short outage without operator action', async r => {
    await armAndDrive(r);
    r.op.streaming = false;
    await until(r, () => r.mode() === Mode.HOLD, 1000, 'HOLD');
    await sleep(300);
    r.op.streaming = true;
    await until(r, () => r.mode() === Mode.ACTIVE, 500, 'ACTIVE again');
  }],
  ['refuses to resume onto a far-away target', async r => {
    await armAndDrive(r);
    r.op.deadman = false;
    await until(r, () => r.mode() === Mode.ARMED, 300, 'ARMED');
    r.op.left = [0.5, 0.35, 1.1];
    r.op.deadman = true;
    await until(r, () => r.mode() === Mode.HOLD, 300, 'HOLD (target jump)');
  }],
  ['detects a frozen joint encoder and will not clear it', async r => {
    await armAndDrive(r);
    r.agent.harness({ kind: 'encoder_freeze', joint: 'left_elbow_joint', on: true });
    r.op.left = [0.36, 0.12, 1.0];
    await until(r, () => r.mode() === Mode.FAULT, 3000, 'FAULT');
    assert.ok(r.agent.mode === Mode.FAULT);
    r.control(ControlKind.ACK_FAULT);
    await sleep(50);
    assert.equal(r.mode(), Mode.FAULT);
    assert.ok(r.events.some(e => e.kind === EventKind.REQUEST_REJECTED));
  }],
  ['detects a weak motor through torque saturation', async r => {
    await armAndDrive(r);
    r.agent.harness({ kind: 'weak_motor', joint: 'right_shoulder_pitch_joint', on: true });
    r.op.right = [0.45, -0.2, 1.0];
    await until(r, () => r.mode() === Mode.FAULT, 4000, 'FAULT');
    assert.ok(r.events.some(e => e.kind === EventKind.FAULT_RAISED && /shoulder pitch/.test(e.message)));
  }],
  ['stops on head-camera loss but only warns on workcell-camera loss', async r => {
    await armAndDrive(r);
    r.agent.harness({ kind: 'camera_dead', camera: 'workcell', on: true });
    await sleep(LIMITS.cameraLostMs + 150);
    assert.equal(r.mode(), Mode.ACTIVE);
    r.agent.harness({ kind: 'camera_dead', camera: 'head', on: true });
    await until(r, () => r.mode() === Mode.FAULT, 1000, 'FAULT');
  }],
  ['will not arm while the head camera is down', async r => {
    await sleep(100);
    r.agent.harness({ kind: 'camera_dead', camera: 'head', on: true });
    await sleep(LIMITS.cameraLostMs + 100);
    r.control(ControlKind.ARM);
    await sleep(50);
    assert.equal(r.mode(), Mode.DISARMED);
    assert.ok(r.events.some(e => e.kind === EventKind.REQUEST_REJECTED && /camera/.test(e.message)));
    r.agent.harness({ kind: 'camera_dead', camera: 'head', on: false });
    await sleep(50);
    r.control(ControlKind.ARM);
    await until(r, () => r.mode() === Mode.ARMED, 500, 'ARMED once the camera is back');
  }],
  ['latches an E-stop until cleared and re-armed', async r => {
    await armAndDrive(r);
    r.control(ControlKind.ESTOP);
    await sleep(20);
    assert.equal(r.mode(), Mode.ESTOP);
    r.control(ControlKind.ARM);
    await sleep(20);
    assert.equal(r.mode(), Mode.ESTOP);
    r.control(ControlKind.CLEAR_ESTOP);
    await sleep(20);
    assert.equal(r.mode(), Mode.DISARMED);
  }],
  ['tracks commands smoothly during normal driving', async r => {
    await armAndDrive(r);
    const path: V3[] = [[0.3, 0.25, 0.95], [0.38, 0.1, 0.9], [0.3, 0.2, 0.86]];
    for (const p of path) { r.op.left = p; await sleep(700); }
    assert.equal(r.mode(), Mode.ACTIVE, 'no spurious faults or holds');
    const err = Math.hypot(...r.agent.truth().left.map((v, i) => v - path[2][i]) as V3);
    assert.ok(err < 0.02, `final hand error ${(err * 100).toFixed(1)} cm`);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  const r = await rig();
  try {
    await fn(r);
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
    console.log('     events:', r.events.slice(-6).map(e => `${EventKind[e.kind]}/${Mode[e.mode]}: ${e.message}`).join(' | '));
  } finally {
    r.stop();
  }
}
process.exit(failed ? 1 : 0);

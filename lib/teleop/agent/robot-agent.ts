// The robot agent: everything that would run on the G1's onboard computer.
//
// It owns the safety-critical loop. The operator station is a client that can
// disappear at any time, so every decision that must hold when the network
// does not lives here: the watchdog, the mode machine, workspace limits, rate
// limits, fault detection and the safe-stop behaviour.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ControlKind, EventKind, FaultCode, HoldReason, Mode,
  decode, dist, encode, fromVec3, now, vec3,
  type ControlRequest, type EnvelopeInit, type V3,
} from '../wire';
import type { CameraId, EpisodeRecord, HarnessFault, RenderGeom, RenderModel } from '../types';
import { ArmIK } from './ik';

export const AGENT_VERSION = 'g1-agent 0.4.0';

// Watchdog and motion limits. These are the numbers worth arguing about.
export const LIMITS = {
  staleMs: 150, // commands older than this: freeze in place (HOLD)
  safeStopMs: 1500, // no commands for this long: retract and disarm (SAFE_STOP)
  jumpM: 0.12, // refuse a resume whose target is this far from where the hand is told to be
  handSpeed: 0.6, // m/s, slew limit on hand targets
  jointSpeed: 2.5, // rad/s while driving
  retractSpeed: 0.7, // rad/s during safe stop
  encoderDisagreeRad: 0.05,
  encoderPersistMs: 60,
  torqueFrac: 0.98,
  torquePersistMs: 250,
  cameraLostMs: 300,
  cameraFrozenMs: 500,
  successM: 0.035,
  successHoldS: 0.35,
};

const DT_MS = 2;
const STATE_PERIOD_MS = 20; // 50 Hz
const VIDEO_PERIOD_MS = 1000 / 30;
const IK_EVERY = 5; // physics steps; 100 Hz
const TABLE_Z = 0.8;
const WORKSPACE = { xMin: 0.12, xMax: 0.56, yMax: 0.42, zMin: TABLE_Z + 0.025, zMax: 1.22, midline: 0.04 };
const REST_TARGETS: Record<'left' | 'right', V3> = { left: [0.24, 0.2, 0.93], right: [0.24, -0.2, 0.93] };

const TORQUE_LIMITS: [RegExp, number][] = [
  [/knee/, 139], [/hip/, 88], [/ankle/, 50], [/waist/, 88],
  [/wrist_(pitch|yaw)/, 5], [/wrist_roll/, 25], [/shoulder|elbow/, 25],
];

type Side = 'left' | 'right';
type Snapshot = { captureAt: number; lastCmdSeq: number; pose: Float32Array; camPos: V3; camMat: number[]; motionStamp: number };
type CameraState = { dead: boolean; frozen: boolean; frozenSnapshot: Snapshot | null; lastFresh: number; faultRaised: FaultCode };
type Episode = { id: string; label: string; pad: string; hand: Side; startedAt: number; holds: number; faults: Set<string>; pathM: number; lastHand: V3; insideSince: number | null };

export class RobotAgent {
  mode = Mode.BOOTING;
  holdReason = HoldReason.NONE;

  private readonly data: any;
  private readonly ik: Record<Side, ArmIK>;
  private readonly sense: any; // second MjData: forward kinematics on what the sensors report
  private readonly nu: number;
  private readonly actQpos: number[]; // actuator i drives qpos[actQpos[i]]
  readonly actuatorNames: string[];
  private readonly torqueLimit: Float64Array;
  private readonly rest: Float64Array;
  private readonly qCmd: Float64Array; // what the motors are told, after rate limiting
  private readonly qDesired: Float64Array; // what IK asks for
  private readonly measured: Float64Array; // joint-side encoders
  private readonly torqueFrac: Float64Array;
  private readonly targets: Record<Side, V3>; // tracked hand targets (slewed, clamped)
  private readonly hands: Record<Side, V3> = { left: [0, 0, 0], right: [0, 0, 0] };
  private readonly pads = new Map<string, V3>();
  private readonly camIds: Record<CameraId, number>;

  private cmd = { seq: 0, recvAt: -Infinity, deadman: false, left: [0, 0, 0] as V3, right: [0, 0, 0] as V3, has: false };
  private readonly active = new Set<FaultCode>();
  private readonly acked = new Set<FaultCode>();
  private faultDetail = '';
  private encoderFrozen = new Map<number, number>(); // qpos index -> frozen value
  private encoderBadSince: number | null = null;
  private torqueBadSince: number | null = null;
  private weakened = new Map<number, [number, number]>(); // actuator -> original range
  private cams: Record<CameraId, CameraState>;
  private episode: Episode | null = null;
  private outbox: EpisodeRecord[] = [];
  private uploading = false;
  private uploadStartedAt = 0;
  private cloudUp = true;

  private simWall = 0;
  private stepCount = 0;
  private lastState = 0;
  private lastVideo = 0;
  private stateSeq = 0;
  private eventSeq = 0;
  private frameSeq: Record<CameraId, number> = { head: 0, workcell: 0 };
  private loadWindow: { at: number; busy: number }[] = [];
  private motionStamp = 0; // bumps whenever the robot visibly moves
  private lastMotionQ: Float64Array;
  private episodeCounter = 0;

  constructor(
    private readonly mj: any,
    private readonly model: any,
    private readonly send: (bytes: Uint8Array, reliable: boolean) => void,
    private readonly upload: (records: EpisodeRecord[]) => void,
    private readonly modelHash = 'dev',
  ) {
    const m = model;
    this.data = new mj.MjData(m);
    this.sense = new mj.MjData(m);
    this.nu = m.nu;
    this.actQpos = Array.from({ length: m.nu }, (_, i) => m.jnt_qposadr[m.actuator_trnid[2 * i]]);
    this.actuatorNames = Array.from({ length: m.nu }, (_, i) => mj.mj_id2name(m, mj.mjtObj.mjOBJ_ACTUATOR.value, i));
    this.torqueLimit = new Float64Array(m.nu);
    this.actuatorNames.forEach((name, i) => {
      const lim = TORQUE_LIMITS.find(([re]) => re.test(name))?.[1] ?? 50;
      this.torqueLimit[i] = lim;
      m.actuator_forcelimited[i] = 1;
      m.actuator_forcerange[2 * i] = -lim;
      m.actuator_forcerange[2 * i + 1] = lim;
    });
    this.camIds = {
      head: mj.mj_name2id(m, mj.mjtObj.mjOBJ_CAMERA.value, 'head_cam'),
      workcell: mj.mj_name2id(m, mj.mjtObj.mjOBJ_CAMERA.value, 'workcell_cam'),
    };
    this.ik = { left: new ArmIK(mj, m, 'left'), right: new ArmIK(mj, m, 'right') };

    // Rest pose: solve IK once for hands parked above the table.
    this.rest = new Float64Array(m.nq);
    for (const side of ['left', 'right'] as const) {
      const s = side === 'left' ? 1 : -1;
      this.rest[m.jnt_qposadr[mj.mj_name2id(m, mj.mjtObj.mjOBJ_JOINT.value, `${side}_shoulder_roll_joint`)]] = 0.2 * s;
      this.rest[m.jnt_qposadr[mj.mj_name2id(m, mj.mjtObj.mjOBJ_JOINT.value, `${side}_elbow_joint`)]] = 1.2;
    }
    const pref = this.rest.slice();
    for (let i = 0; i < 80; i++) for (const side of ['left', 'right'] as const) this.ik[side].solve(this.rest, REST_TARGETS[side], pref, 1);

    this.qCmd = this.rest.slice();
    this.qDesired = this.rest.slice();
    this.measured = this.rest.slice();
    this.lastMotionQ = this.rest.slice();
    this.torqueFrac = new Float64Array(m.nu);
    this.data.qpos.set(this.rest);
    mj.mj_forward(m, this.data);
    this.targets = { left: this.site('left_hand'), right: this.site('right_hand') };

    for (let i = 0; i < m.nsite; i++) {
      const name = mj.mj_id2name(m, mj.mjtObj.mjOBJ_SITE.value, i);
      if (name?.startsWith('pad_')) this.pads.set(name, [this.data.site_xpos[3 * i], this.data.site_xpos[3 * i + 1], this.data.site_xpos[3 * i + 2]]);
    }
    const t = now();
    const cam = (): CameraState => ({ dead: false, frozen: false, frozenSnapshot: null, lastFresh: t, faultRaised: FaultCode.NONE });
    this.cams = { head: cam(), workcell: cam() };
    this.simWall = t;
    this.setMode(Mode.DISARMED, HoldReason.NONE, 'Agent booted. Motors holding the rest pose.');
  }

  // ---------------------------------------------------------------- inputs

  receive(bytes: Uint8Array) {
    const env = decode(bytes);
    const b = env.body;
    if (b.case === 'command') {
      const c = b.value;
      if (c.seq <= this.cmd.seq && this.cmd.has) return; // stale or reordered: newer already applied
      this.cmd = { seq: c.seq, recvAt: now(), deadman: c.deadman, left: fromVec3(c.leftTarget), right: fromVec3(c.rightTarget), has: true };
    } else if (b.case === 'ping') {
      this.publish({ body: { case: 'pong', value: { seq: b.value.seq, pingSentAtMs: b.value.sentAtMs } } }, false);
    } else if (b.case === 'control') {
      this.control(b.value);
    }
  }

  harness(f: HarnessFault) {
    if (f.kind === 'camera_dead') this.cams[f.camera].dead = f.on;
    if (f.kind === 'camera_frozen') {
      this.cams[f.camera].frozen = f.on;
      this.cams[f.camera].frozenSnapshot = f.on ? this.snapshot(f.camera) : null;
    }
    if (f.kind === 'encoder_freeze') {
      const a = this.qposOfJoint(f.joint);
      if (f.on) this.encoderFrozen.set(a, this.data.qpos[a]);
      else this.encoderFrozen.delete(a);
    }
    if (f.kind === 'weak_motor') {
      const i = this.actuatorNames.indexOf(f.joint);
      if (i < 0) return;
      const r = this.model.actuator_forcerange;
      if (f.on && !this.weakened.has(i)) {
        this.weakened.set(i, [r[2 * i], r[2 * i + 1]]);
        r[2 * i] = -2.5; r[2 * i + 1] = 2.5; // a motor that can only make 10% of its rated torque
      } else if (!f.on && this.weakened.has(i)) {
        const [lo, hi] = this.weakened.get(i)!;
        r[2 * i] = lo; r[2 * i + 1] = hi;
        this.weakened.delete(i);
      }
    }
  }

  setCloud(up: boolean) { this.cloudUp = up; }

  uploaded(ids: string[]) {
    const set = new Set(ids);
    const n = this.outbox.length;
    this.outbox = this.outbox.filter(r => !set.has(r.id));
    this.uploading = false;
    if (this.outbox.length < n) this.event(EventKind.LOG_UPLOADED, { message: `${n - this.outbox.length} episode log(s) uploaded to the control plane.` });
  }

  // ------------------------------------------------------------- main loop

  /** Advance the simulation to wall-clock time and publish what is due. */
  tick() {
    const t0 = performance.now();
    const wall = now();
    let due = Math.floor((wall - this.simWall) / DT_MS);
    if (due > 100) { // more than 200 ms behind: drop time rather than fast-forward the robot
      this.simWall = wall - 100 * DT_MS;
      due = 100;
    }
    for (let i = 0; i < due; i++) {
      this.simWall += DT_MS;
      this.step(this.simWall);
    }
    const busy = performance.now() - t0;
    this.loadWindow.push({ at: wall, busy });
    while (this.loadWindow.length && this.loadWindow[0].at < wall - 1000) this.loadWindow.shift();

    if (wall - this.lastState >= STATE_PERIOD_MS) { this.lastState = wall; this.publishState(wall); }
    if (wall - this.lastVideo >= VIDEO_PERIOD_MS) { this.lastVideo = wall; this.publishVideo(wall); }
    if (this.uploading && wall - this.uploadStartedAt > 3000) this.uploading = false; // no ack: retry
    if (this.cloudUp && !this.uploading && this.outbox.length) {
      this.uploading = true;
      this.uploadStartedAt = wall;
      this.upload(this.outbox.slice(0, 8));
    }
  }

  private step(t: number) {
    const m = this.model, d = this.data;
    const cmdAge = t - this.cmd.recvAt;
    const fresh = this.cmd.has && cmdAge <= LIMITS.staleMs;

    this.updateMode(t, cmdAge, fresh);

    if (this.mode === Mode.ACTIVE && this.stepCount % IK_EVERY === 0) {
      for (const side of ['left', 'right'] as const) {
        const goal = this.clampWorkspace(side, this.cmd[side]);
        this.targets[side] = slew(this.targets[side], goal, LIMITS.handSpeed * IK_EVERY * DT_MS / 1000);
        this.ik[side].solve(this.qDesired, this.targets[side], this.rest);
      }
    }

    // Rate-limit joint commands toward the goal for this mode.
    const retracting = this.mode === Mode.SAFE_STOP || this.mode === Mode.DISARMED;
    const goal = retracting ? this.rest : this.qDesired;
    const maxStep = (retracting ? LIMITS.retractSpeed : LIMITS.jointSpeed) * DT_MS / 1000;
    const moving = this.mode === Mode.ACTIVE || retracting;
    if (moving) {
      let settled = true;
      for (let i = 0; i < this.nu; i++) {
        const a = this.actQpos[i];
        const delta = goal[a] - this.qCmd[a];
        if (Math.abs(delta) > 1e-4) settled = false;
        this.qCmd[a] += Math.max(-maxStep, Math.min(maxStep, delta));
      }
      if (this.mode === Mode.SAFE_STOP && settled) this.setMode(Mode.DISARMED, HoldReason.NONE, 'Safe stop complete: arms retracted, robot disarmed.');
    }
    for (let i = 0; i < this.nu; i++) d.ctrl[i] = this.qCmd[this.actQpos[i]];

    this.mj.mj_step(m, d);
    this.stepCount++;

    this.readSensors(t);
    this.checkFaults(t);
    this.trackEpisode(t);
  }

  // ------------------------------------------------------------ mode logic

  private updateMode(t: number, cmdAge: number, fresh: boolean) {
    const mode = this.mode;
    if (mode === Mode.ESTOP || mode === Mode.FAULT || mode === Mode.SAFE_STOP || mode === Mode.DISARMED || mode === Mode.BOOTING) return;

    if (!fresh && cmdAge > LIMITS.safeStopMs) {
      this.setMode(Mode.SAFE_STOP, HoldReason.STALE_COMMANDS, `No commands for ${(cmdAge / 1000).toFixed(1)} s. Retracting arms and disarming.`);
      return;
    }
    if (mode === Mode.ACTIVE) {
      if (!fresh) return this.hold(HoldReason.STALE_COMMANDS, `Commands are ${Math.round(cmdAge)} ms old. Holding position.`);
      if (!this.cmd.deadman) return this.setMode(Mode.ARMED, HoldReason.DEADMAN_RELEASED, 'Deadman released.');
      return;
    }
    // ARMED or HOLD: can we (re)enter ACTIVE?
    if (!fresh) {
      if (mode === Mode.ARMED && this.cmd.deadman) this.hold(HoldReason.STALE_COMMANDS, `Commands are ${Math.round(cmdAge)} ms old. Holding position.`);
      return;
    }
    if (!this.cmd.deadman) {
      if (mode === Mode.HOLD) this.setMode(Mode.ARMED, HoldReason.DEADMAN_RELEASED, 'Deadman released.');
      return;
    }
    const jump = Math.max(dist(this.cmd.left, this.targets.left), dist(this.cmd.right, this.targets.right));
    if (jump > LIMITS.jumpM) {
      if (this.holdReason !== HoldReason.TARGET_JUMP) this.hold(HoldReason.TARGET_JUMP, `Commanded target is ${(jump * 100).toFixed(0)} cm from the hand. Resync before driving.`);
      return;
    }
    this.qDesired.set(this.qCmd);
    this.setMode(Mode.ACTIVE, HoldReason.NONE, mode === Mode.HOLD ? 'Commands fresh again. Resuming.' : 'Deadman held. Driving.');
  }

  private hold(reason: HoldReason, message: string) {
    this.qDesired.set(this.qCmd); // freeze exactly where the motors are being told to be
    this.setMode(Mode.HOLD, reason, message);
  }

  private control(req: ControlRequest) {
    const ok = (message: string) => this.event(EventKind.REQUEST_ACCEPTED, { requestId: req.requestId, message });
    const no = (message: string) => this.event(EventKind.REQUEST_REJECTED, { requestId: req.requestId, message });
    switch (req.kind) {
      case ControlKind.ESTOP:
        // Latch first, explain later. Freeze at the measured (motor-side) pose.
        for (let i = 0; i < this.nu; i++) { const a = this.actQpos[i]; this.qCmd[a] = this.data.qpos[a]; }
        this.qDesired.set(this.qCmd);
        this.setMode(Mode.ESTOP, HoldReason.NONE, 'Emergency stop latched by the operator.');
        if (this.episode) this.endEpisode('aborted');
        return ok('E-stop latched.');
      case ControlKind.CLEAR_ESTOP:
        if (this.mode !== Mode.ESTOP) return no('Not in E-stop.');
        this.setMode(Mode.DISARMED, HoldReason.NONE, 'E-stop cleared. Robot disarmed; arm again to drive.');
        return ok('E-stop cleared.');
      case ControlKind.ARM:
        if (this.mode === Mode.ESTOP) return no('Clear the E-stop first.');
        if (this.mode === Mode.FAULT) return no('Acknowledge the fault first.');
        if (this.mode !== Mode.DISARMED) return no('Already armed.');
        if (this.cams.head.faultRaised !== FaultCode.NONE && !this.acked.has(this.cams.head.faultRaised)) return no('Head camera is down. The robot will not arm blind.');
        if (this.active.has(FaultCode.ENCODER_DISAGREE)) return no('Encoders disagree. This joint needs service.');
        this.resyncTargets();
        this.setMode(Mode.ARMED, HoldReason.NONE, 'Armed. Hold the deadman to drive.');
        return ok('Armed.');
      case ControlKind.DISARM:
        if (this.mode === Mode.ESTOP) return no('In E-stop.');
        this.setMode(Mode.SAFE_STOP, HoldReason.NONE, 'Disarm requested. Retracting arms.');
        return ok('Disarming.');
      case ControlKind.ACK_FAULT: {
        if (this.mode !== Mode.FAULT) return no('No fault to acknowledge.');
        if (this.active.has(FaultCode.ENCODER_DISAGREE)) return no('Encoders still disagree. This joint needs service before the robot can move.');
        for (const f of this.active) this.acked.add(f);
        this.resyncTargets();
        this.setMode(Mode.ARMED, HoldReason.NONE, this.active.size ? 'Fault acknowledged. Driving with a known degraded condition.' : 'Fault acknowledged. Armed.');
        return ok('Fault acknowledged.');
      }
      case ControlKind.START_EPISODE: {
        const task = req.task;
        if (!task || !this.pads.has(task.pad)) return no('Unknown task.');
        if (this.mode === Mode.ESTOP || this.mode === Mode.FAULT) return no('Robot is not available.');
        if (this.episode) this.endEpisode('aborted');
        const hand = task.hand === 'right' ? 'right' : 'left';
        this.episode = { id: task.id || `ep-${++this.episodeCounter}`, label: task.label, pad: task.pad, hand, startedAt: now(), holds: 0, faults: new Set(), pathM: 0, lastHand: this.hands[hand], insideSince: null };
        this.event(EventKind.EPISODE_STARTED, { episodeId: this.episode.id, message: task.label });
        return ok('Episode started.');
      }
      case ControlKind.ABORT_EPISODE:
        if (!this.episode) return no('No episode running.');
        this.endEpisode('aborted');
        return ok('Episode aborted.');
      default:
        return no('Unknown request.');
    }
  }

  private resyncTargets() {
    this.qDesired.set(this.qCmd);
    this.targets.left = this.ik.left.forward(this.qCmd);
    this.targets.right = this.ik.right.forward(this.qCmd);
  }

  private setMode(mode: Mode, reason: HoldReason, message: string) {
    if (mode === this.mode && reason === this.holdReason) return;
    if (mode === Mode.HOLD && this.mode !== Mode.HOLD && this.episode) this.episode.holds++;
    this.mode = mode;
    this.holdReason = reason;
    if (mode === Mode.DISARMED || mode === Mode.SAFE_STOP) this.qDesired.set(this.rest);
    this.event(EventKind.MODE_CHANGED, { message });
  }

  // ---------------------------------------------------- sensing and faults

  private readSensors(t: number) {
    const q = this.data.qpos;
    for (let i = 0; i < this.nu; i++) {
      const a = this.actQpos[i];
      this.measured[a] = this.encoderFrozen.get(a) ?? q[a];
      const f = Math.abs(this.data.actuator_force[i]);
      const lim = this.weakened.has(i) ? Math.abs(this.model.actuator_forcerange[2 * i + 1]) : this.torqueLimit[i];
      this.torqueFrac[i] = Math.min(1, f / lim);
    }
    if (this.stepCount % 10 === 0) {
      // Hand positions as the robot believes them: forward kinematics on encoder readings.
      this.sense.qpos.set(this.measured);
      this.mj.mj_kinematics(this.model, this.sense);
      for (const side of ['left', 'right'] as const) this.hands[side] = this.siteOf(this.sense, `${side}_hand`);
      let moved = 0;
      for (let i = 0; i < this.nu; i++) { const a = this.actQpos[i]; moved = Math.max(moved, Math.abs(q[a] - this.lastMotionQ[a])); }
      if (moved > 0.002) { this.motionStamp++; this.lastMotionQ.set(q); }
    }
    for (const id of ['head', 'workcell'] as const) {
      const c = this.cams[id];
      if (!c.dead && !c.frozen) c.lastFresh = t;
    }
  }

  private checkFaults(t: number) {
    // Encoders: motor-side (qpos) vs joint-side (measured).
    let worst = 0, worstJoint = -1;
    for (let i = 0; i < this.nu; i++) {
      const a = this.actQpos[i];
      const e = Math.abs(this.data.qpos[a] - this.measured[a]);
      if (e > worst) { worst = e; worstJoint = i; }
    }
    if (worst > LIMITS.encoderDisagreeRad) {
      this.encoderBadSince ??= t;
      if (t - this.encoderBadSince > LIMITS.encoderPersistMs) this.raise(FaultCode.ENCODER_DISAGREE, `${pretty(this.actuatorNames[worstJoint])}: motor and joint encoders disagree by ${(worst * 57.3).toFixed(1)}°.`, true);
    } else {
      this.encoderBadSince = null;
      this.clear(FaultCode.ENCODER_DISAGREE);
    }

    // Torque: sustained saturation means the robot cannot do what it is told.
    let sat = -1;
    for (let i = 0; i < this.nu; i++) if (this.torqueFrac[i] >= LIMITS.torqueFrac) { sat = i; break; }
    if (sat >= 0) {
      this.torqueBadSince ??= t;
      if (t - this.torqueBadSince > LIMITS.torquePersistMs) this.raise(FaultCode.TORQUE_SATURATED, `${pretty(this.actuatorNames[sat])} has been at its torque limit for ${LIMITS.torquePersistMs} ms.`, true);
    } else {
      this.torqueBadSince = null;
      if (this.stepCount % 50 === 0 && this.weakened.size === 0) this.clear(FaultCode.TORQUE_SATURATED);
    }

    // Cameras. Losing the head camera stops the robot; losing the workcell camera is a warning.
    // Like every condition above, re-asserted on every step while it holds, so arming
    // later cannot slip past a fault that started while the robot was parked.
    const camCodes = new Set<FaultCode>();
    for (const id of ['head', 'workcell'] as const) {
      const c = this.cams[id];
      const name = id === 'head' ? 'Head' : 'Workcell';
      let code = FaultCode.NONE, detail = '';
      if (c.dead && t - c.lastFresh > LIMITS.cameraLostMs) { code = FaultCode.CAMERA_LOST; detail = `${name} camera: no frames for ${LIMITS.cameraLostMs} ms.`; }
      else if (c.frozen && c.frozenSnapshot && (this.motionStamp !== c.frozenSnapshot.motionStamp || c.faultRaised === FaultCode.CAMERA_FROZEN) && t - c.lastFresh > LIMITS.cameraFrozenMs) { code = FaultCode.CAMERA_FROZEN; detail = `${name} camera: image unchanged while the robot moved.`; }
      c.faultRaised = code;
      if (code !== FaultCode.NONE) { camCodes.add(code); this.raise(code, detail, id === 'head'); }
    }
    for (const code of [FaultCode.CAMERA_LOST, FaultCode.CAMERA_FROZEN]) if (!camCodes.has(code)) this.clear(code);
  }

  private raise(code: FaultCode, detail: string, stop: boolean) {
    const isNew = !this.active.has(code);
    this.active.add(code);
    if (isNew) {
      this.faultDetail = detail;
      if (this.episode) this.episode.faults.add(FaultCode[code]);
      this.event(EventKind.FAULT_RAISED, { fault: code, message: detail });
    }
    const movable = this.mode === Mode.ACTIVE || this.mode === Mode.ARMED || this.mode === Mode.HOLD;
    if (stop && movable && !this.acked.has(code)) {
      this.qDesired.set(this.qCmd);
      this.setMode(Mode.FAULT, HoldReason.NONE, detail);
    }
  }

  private clear(code: FaultCode) {
    if (!this.active.delete(code)) return;
    this.acked.delete(code);
    this.event(EventKind.FAULT_CLEARED, { fault: code, message: `${FaultCode[code].replaceAll('_', ' ').toLowerCase()} cleared.` });
  }

  // -------------------------------------------------------------- episodes

  private trackEpisode(t: number) {
    const ep = this.episode;
    if (!ep || this.stepCount % 10 !== 0) return;
    const hand = this.hands[ep.hand];
    ep.pathM += dist(hand, ep.lastHand);
    ep.lastHand = hand;
    const d = dist(hand, this.pads.get(ep.pad)!);
    if (d < LIMITS.successM) {
      ep.insideSince ??= t;
      if (t - ep.insideSince > LIMITS.successHoldS * 1000) this.endEpisode('success');
    } else ep.insideSince = null;
  }

  private endEpisode(outcome: 'success' | 'aborted') {
    const ep = this.episode;
    if (!ep) return;
    this.episode = null;
    const durationS = (now() - ep.startedAt) / 1000;
    this.outbox.push({ id: ep.id, taskLabel: ep.label, hand: ep.hand, outcome, durationS, holds: ep.holds, faults: [...ep.faults], pathM: ep.pathM, endedAt: now(), agentVersion: AGENT_VERSION });
    this.event(outcome === 'success' ? EventKind.EPISODE_SUCCEEDED : EventKind.EPISODE_ABORTED, { episodeId: ep.id, durationS, message: ep.label });
  }

  // ------------------------------------------------------------ publishing

  private publish(init: EnvelopeInit, reliable: boolean) {
    this.send(encode(init), reliable);
  }

  private event(kind: EventKind, rest: { requestId?: number; message?: string; fault?: FaultCode; episodeId?: string; durationS?: number }) {
    this.publish({ body: { case: 'event', value: { seq: ++this.eventSeq, atMs: now(), kind, mode: this.mode, holdReason: this.holdReason, ...rest } } }, true);
  }

  private publishState(t: number) {
    const ep = this.episode;
    const load = this.loadWindow.reduce((s, w) => s + w.busy, 0) / 1000;
    this.publish({
      body: {
        case: 'state', value: {
          seq: ++this.stateSeq, sentAtMs: t, mode: this.mode, holdReason: this.holdReason,
          lastCmdSeq: this.cmd.seq, cmdAgeMs: this.cmd.has ? t - this.cmd.recvAt : -1,
          leftHand: vec3(this.hands.left), rightHand: vec3(this.hands.right),
          leftTarget: vec3(this.targets.left), rightTarget: vec3(this.targets.right),
          jointPos: Array.from(this.actQpos, a => this.measured[a]),
          torqueFrac: Array.from(this.torqueFrac),
          faults: [...this.active],
          episodeId: ep?.id ?? '', episodeDistM: ep ? dist(this.hands[ep.hand], this.pads.get(ep.pad)!) : 0,
          outbox: this.outbox.length, simLoad: load,
        },
      },
    }, false);
  }

  private snapshot(id: CameraId): Snapshot {
    const d = this.data, nb = this.model.nbody;
    const pose = new Float32Array(nb * 7);
    for (let b = 0; b < nb; b++) {
      pose.set([d.xpos[3 * b], d.xpos[3 * b + 1], d.xpos[3 * b + 2], d.xquat[4 * b], d.xquat[4 * b + 1], d.xquat[4 * b + 2], d.xquat[4 * b + 3]], 7 * b);
    }
    const c = this.camIds[id];
    return {
      captureAt: now(), lastCmdSeq: this.cmd.seq, pose, motionStamp: this.motionStamp,
      camPos: [d.cam_xpos[3 * c], d.cam_xpos[3 * c + 1], d.cam_xpos[3 * c + 2]],
      camMat: Array.from(d.cam_xmat.subarray(9 * c, 9 * c + 9)),
    };
  }

  private publishVideo(_t: number) {
    for (const id of ['head', 'workcell'] as const) {
      const c = this.cams[id];
      if (c.dead) continue;
      const s = c.frozen && c.frozenSnapshot ? c.frozenSnapshot : this.snapshot(id);
      this.publish({
        body: {
          case: 'video', value: {
            camera: id, frameSeq: ++this.frameSeq[id], captureAtMs: s.captureAt, lastCmdSeq: s.lastCmdSeq,
            bodyPose: Array.from(s.pose), camPos: vec3(s.camPos), camMat: s.camMat,
          },
        },
      }, false);
    }
  }

  // ---------------------------------------------------------------- helpers

  private clampWorkspace(side: Side, p: V3): V3 {
    const w = WORKSPACE;
    const y = side === 'left' ? Math.max(-w.midline, Math.min(w.yMax, p[1])) : Math.max(-w.yMax, Math.min(w.midline, p[1]));
    return [Math.max(w.xMin, Math.min(w.xMax, p[0])), y, Math.max(w.zMin, Math.min(w.zMax, p[2]))];
  }

  private qposOfJoint(name: string): number {
    return this.model.jnt_qposadr[this.mj.mj_name2id(this.model, this.mj.mjtObj.mjOBJ_JOINT.value, name)];
  }

  private site(name: string): V3 { return this.siteOf(this.data, name); }

  private siteOf(d: any, name: string): V3 {
    const i = this.mj.mj_name2id(this.model, this.mj.mjtObj.mjOBJ_SITE.value, name);
    return [d.site_xpos[3 * i], d.site_xpos[3 * i + 1], d.site_xpos[3 * i + 2]];
  }

  /** Geometry and metadata the station needs to render camera frames. Sent once at boot. */
  renderModel(): RenderModel {
    const m = this.model, mj = this.mj;
    const types: Record<number, RenderGeom['type']> = { 0: 'plane', 2: 'sphere', 3: 'capsule', 4: 'ellipsoid', 5: 'cylinder', 6: 'box', 7: 'mesh' };
    const meshIndex = new Map<number, number>();
    const meshes: RenderModel['meshes'] = [];
    const geoms: RenderGeom[] = [];
    for (let g = 0; g < m.ngeom; g++) {
      if (m.geom_group[g] > 2) continue; // collision and debug groups
      const type = types[m.geom_type[g]];
      if (!type) continue;
      let mesh = -1;
      if (type === 'mesh') {
        const id = m.geom_dataid[g];
        if (!meshIndex.has(id)) {
          const va = m.mesh_vertadr[id], vn = m.mesh_vertnum[id], fa = m.mesh_faceadr[id], fn = m.mesh_facenum[id];
          meshes.push({ vert: m.mesh_vert.slice(3 * va, 3 * (va + vn)), face: Uint32Array.from(m.mesh_face.subarray(3 * fa, 3 * (fa + fn))) });
          meshIndex.set(id, meshes.length - 1);
        }
        mesh = meshIndex.get(id)!;
      }
      const mat = m.geom_matid[g];
      const rgba = mat >= 0 ? m.mat_rgba.subarray(4 * mat, 4 * mat + 4) : m.geom_rgba.subarray(4 * g, 4 * g + 4);
      geoms.push({
        body: m.geom_bodyid[g], type, mesh,
        name: mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM.value, g) ?? '',
        size: [m.geom_size[3 * g], m.geom_size[3 * g + 1], m.geom_size[3 * g + 2]],
        pos: [m.geom_pos[3 * g], m.geom_pos[3 * g + 1], m.geom_pos[3 * g + 2]],
        quat: [m.geom_quat[4 * g], m.geom_quat[4 * g + 1], m.geom_quat[4 * g + 2], m.geom_quat[4 * g + 3]],
        rgba: [rgba[0], rgba[1], rgba[2], rgba[3]],
      });
    }
    const padRgba = (name: string) => geoms.find(g => g.name === name)?.rgba ?? [1, 1, 1, 1];
    return {
      nbody: m.nbody, geoms, meshes,
      cameras: { head: { fovy: m.cam_fovy[this.camIds.head] }, workcell: { fovy: m.cam_fovy[this.camIds.workcell] } },
      pads: [...this.pads].map(([name, pos]) => ({ name, pos, rgba: padRgba(name) })),
      actuators: this.actuatorNames, tableZ: TABLE_Z,
      rest: { left: this.ik.left.forward(this.rest), right: this.ik.right.forward(this.rest) },
      agentVersion: AGENT_VERSION, modelHash: this.modelHash,
    };
  }

  /** Ground truth for tests and the bench harness: where the hands really are. */
  truth(): { left: V3; right: V3; mode: Mode } {
    return { left: this.site('left_hand'), right: this.site('right_hand'), mode: this.mode };
  }
}

function slew(from: V3, to: V3, maxStep: number): V3 {
  const d = dist(from, to);
  if (d <= maxStep) return to;
  const s = maxStep / d;
  return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s, from[2] + (to[2] - from[2]) * s];
}

export function pretty(actuator: string): string {
  return actuator.replace(/_joint$/, '').replaceAll('_', ' ');
}

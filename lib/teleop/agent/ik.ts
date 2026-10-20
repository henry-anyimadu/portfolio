// Weighted damped-least-squares IK for one 7-DoF G1 arm, position only.
// Runs on the robot: the operator sends hand positions, never joint angles.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { V3 } from '../wire';

const ARM_JOINTS = ['shoulder_pitch', 'shoulder_roll', 'shoulder_yaw', 'elbow', 'wrist_roll', 'wrist_pitch', 'wrist_yaw'];
// Higher weight = the solver prefers not to use that joint. Keeps the wrist
// near neutral and makes the shoulder and elbow do the reaching.
const WEIGHTS = [1, 1, 1.5, 1, 6, 3, 6];
const DAMPING = 0.05;
const NULLSPACE_GAIN = 0.08;
const MAX_STEP_RAD = 0.12;
const MAX_ERR_STEP_M = 0.05;
const LIMIT_MARGIN = 0.04;

export class ArmIK {
  readonly qadr: number[];
  private readonly dof: number[];
  private readonly lo: number[];
  private readonly hi: number[];
  private readonly site: number;
  private readonly data: any;
  private readonly jac: any;

  constructor(private readonly mj: any, private readonly model: any, readonly side: 'left' | 'right') {
    const jointId = (n: string) => mj.mj_name2id(model, mj.mjtObj.mjOBJ_JOINT.value, `${side}_${n}_joint`);
    const ids = ARM_JOINTS.map(jointId);
    this.qadr = ids.map(j => model.jnt_qposadr[j]);
    this.dof = ids.map(j => model.jnt_dofadr[j]);
    this.lo = ids.map(j => model.jnt_range[2 * j] + LIMIT_MARGIN);
    this.hi = ids.map(j => model.jnt_range[2 * j + 1] - LIMIT_MARGIN);
    this.site = mj.mj_name2id(model, mj.mjtObj.mjOBJ_SITE.value, `${side}_hand`);
    this.data = new mj.MjData(model);
    this.jac = new mj.DoubleBuffer(3 * model.nv);
  }

  /** Hand position for joint configuration q (full qpos vector). */
  forward(q: Float64Array): V3 {
    this.data.qpos.set(q);
    this.mj.mj_kinematics(this.model, this.data);
    const p = this.data.site_xpos;
    return [p[3 * this.site], p[3 * this.site + 1], p[3 * this.site + 2]];
  }

  /** Moves this arm's entries of q toward reaching target. Returns remaining error (m). */
  solve(q: Float64Array, target: V3, rest: Float64Array, iterations = 2): number {
    const nv = this.model.nv;
    let err = 0;
    for (let it = 0; it < iterations; it++) {
      this.data.qpos.set(q);
      this.mj.mj_kinematics(this.model, this.data);
      this.mj.mj_comPos(this.model, this.data);
      const p = this.data.site_xpos;
      let e0 = target[0] - p[3 * this.site];
      let e1 = target[1] - p[3 * this.site + 1];
      let e2 = target[2] - p[3 * this.site + 2];
      err = Math.hypot(e0, e1, e2);
      if (err < 5e-4) break;
      if (err > MAX_ERR_STEP_M) {
        const s = MAX_ERR_STEP_M / err;
        e0 *= s; e1 *= s; e2 *= s;
      }
      this.mj.mj_jacSite(this.model, this.data, this.jac, null, this.site);
      const jv = this.jac.GetView() as Float64Array;
      const J: number[][] = [0, 1, 2].map(r => this.dof.map(d => jv[r * nv + d]));
      const Wi = WEIGHTS.map(w => 1 / w);

      // A = J W^-1 J^T + λ²I  (3x3)
      const A = [0, 1, 2].map(r => [0, 1, 2].map(c => {
        let s = r === c ? DAMPING * DAMPING : 0;
        for (let k = 0; k < 7; k++) s += J[r][k] * Wi[k] * J[c][k];
        return s;
      }));
      const Ai = inv3(A);
      // Jp = W^-1 J^T A^-1  (7x3)
      const Jp = [0, 1, 2, 3, 4, 5, 6].map(k => [0, 1, 2].map(c => Wi[k] * (J[0][k] * Ai[0][c] + J[1][k] * Ai[1][c] + J[2][k] * Ai[2][c])));
      const e = [e0, e1, e2];
      const z = this.qadr.map((a, k) => NULLSPACE_GAIN * (rest[a] - q[a]));
      // Jz = J z
      const Jz = [0, 1, 2].map(r => J[r].reduce((s, v, k) => s + v * z[k], 0));
      for (let k = 0; k < 7; k++) {
        // dq = Jp e + (I - Jp J) z = Jp (e - J z) + z
        let dq = z[k];
        for (let c = 0; c < 3; c++) dq += Jp[k][c] * (e[c] - Jz[c]);
        dq = Math.max(-MAX_STEP_RAD, Math.min(MAX_STEP_RAD, dq));
        const a = this.qadr[k];
        q[a] = Math.max(this.lo[k], Math.min(this.hi[k], q[a] + dq));
      }
    }
    return err;
  }

  dispose() {
    this.jac.delete();
    this.data.delete();
  }
}

function inv3(m: number[][]): number[][] {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const s = 1 / det;
  return [
    [A * s, -(b * i - c * h) * s, (b * f - c * e) * s],
    [B * s, (a * i - c * g) * s, -(a * f - c * d) * s],
    [C * s, -(a * h - b * g) * s, (a * e - b * d) * s],
  ];
}

// Messages between the page and the robot-agent worker that are NOT on the
// emulated network: the bench harness (fault injection), the boot handshake,
// and the robot's upload path to the control plane.
import type { V3 } from './wire';

export type GeomType = 'plane' | 'sphere' | 'capsule' | 'ellipsoid' | 'cylinder' | 'box' | 'mesh';

export type RenderGeom = {
  body: number;
  type: GeomType;
  size: V3;
  pos: V3;
  quat: [number, number, number, number]; // w x y z
  rgba: [number, number, number, number];
  mesh: number; // index into RenderModel.meshes, or -1
  name: string;
};

export type RenderModel = {
  nbody: number;
  geoms: RenderGeom[];
  meshes: { vert: Float32Array; face: Uint32Array }[];
  cameras: Record<CameraId, { fovy: number }>;
  pads: { name: string; pos: V3; rgba: [number, number, number, number] }[];
  actuators: string[];
  tableZ: number;
  rest: { left: V3; right: V3 };
  agentVersion: string;
  modelHash: string;
};

export type CameraId = 'head' | 'workcell';

export type HarnessFault =
  | { kind: 'camera_dead'; camera: CameraId; on: boolean }
  | { kind: 'camera_frozen'; camera: CameraId; on: boolean }
  | { kind: 'encoder_freeze'; joint: string; on: boolean }
  | { kind: 'weak_motor'; joint: string; on: boolean };

export type EpisodeRecord = {
  id: string;
  taskLabel: string;
  hand: 'left' | 'right';
  outcome: 'success' | 'aborted';
  durationS: number;
  holds: number;
  faults: string[];
  pathM: number;
  endedAt: number;
  agentVersion: string;
};

export type ToWorker =
  | { t: 'net'; bytes: Uint8Array; reliable: boolean }
  | { t: 'harness'; fault: HarnessFault }
  | { t: 'uploaded'; ids: string[] }
  | { t: 'cloud'; up: boolean };

export type FromWorker =
  | { t: 'net'; bytes: Uint8Array; reliable: boolean }
  | { t: 'boot'; stage: string }
  | { t: 'ready'; model: RenderModel }
  | { t: 'error'; message: string }
  | { t: 'upload'; records: EpisodeRecord[] };

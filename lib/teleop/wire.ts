// Shared helpers for the teleop wire format (see proto/teleop.proto).
import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import { EnvelopeSchema, Vec3Schema, type Envelope, type Vec3 } from './gen/teleop_pb';

export * from './gen/teleop_pb';

/** Epoch milliseconds with sub-millisecond resolution. Comparable between the page and its worker. */
export function now(): number {
  return performance.timeOrigin + performance.now();
}

export type EnvelopeInit = MessageInitShape<typeof EnvelopeSchema>;

export function encode(init: EnvelopeInit): Uint8Array {
  return toBinary(EnvelopeSchema, create(EnvelopeSchema, init));
}

export function decode(bytes: Uint8Array): Envelope {
  return fromBinary(EnvelopeSchema, bytes);
}

export type V3 = [number, number, number];

export function vec3(v: V3): Vec3 {
  return create(Vec3Schema, { x: v[0], y: v[1], z: v[2] });
}

export function fromVec3(v: Vec3 | undefined): V3 {
  return v ? [v.x, v.y, v.z] : [0, 0, 0];
}

export function dist(a: V3, b: V3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

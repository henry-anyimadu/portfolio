// The robot description ships as one file: [u32 header length][JSON header][file blobs].
// scripts/teleop/pack_bundle.mjs writes it.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Bundle = { entry: string; files: { name: string; bytes: Uint8Array }[]; hash: string };

export function parseBundle(buf: ArrayBuffer): Bundle {
  const view = new DataView(buf);
  const headerLen = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headerLen))) as {
    entry: string;
    files: { name: string; offset: number; length: number }[];
  };
  const base = 4 + headerLen;
  return {
    entry: header.entry,
    files: header.files.map(f => ({ name: f.name, bytes: new Uint8Array(buf, base + f.offset, f.length) })),
    hash: fnv1a(new Uint8Array(buf)),
  };
}

export function compileBundle(mj: any, bundle: Bundle): any {
  const vfs = new mj.MjVFS();
  try {
    for (const f of bundle.files) vfs.addBuffer(f.name, f.bytes);
    return mj.MjModel.from_xml_path(bundle.entry, vfs);
  } finally {
    vfs.delete();
  }
}

function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 7) { // sampled: a fingerprint, not a checksum
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

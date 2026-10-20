// One camera's renderer, off the main thread. The page's main thread carries
// input, the command stream and the network; a slow GPU must never stall it.
import { CameraView, type FramePose, type Overlay } from './render';
import type { CameraId, RenderModel } from './types';

export type ToRender =
  | { t: 'init'; canvas: OffscreenCanvas; model: RenderModel; camera: CameraId; dpr: number; priority: 1 | 2 }
  | { t: 'size'; w: number; h: number }
  | { t: 'frame'; frame: FramePose }
  | { t: 'overlay'; overlay: Overlay }
  | { t: 'visible'; visible: boolean };

let view: CameraView | null = null;
let frame: FramePose | null = null;
let overlay: Overlay = { targets: null, pad: null, hand: null };
let priority: 1 | 2 = 1;
let pending = false;

function schedule(delay = 0) {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    if (view?.draw(frame, overlay, priority) === 'skipped') schedule(16);
  }, delay);
}

self.onmessage = (e: MessageEvent<ToRender>) => {
  const m = e.data;
  switch (m.t) {
    case 'init':
      view = new CameraView(m.canvas, m.model, m.camera, m.dpr);
      priority = m.priority;
      break;
    case 'size': view?.setSize(m.w, m.h); break;
    case 'frame': frame = m.frame; break;
    case 'overlay': overlay = m.overlay; break;
    case 'visible': if (view) view.visible = m.visible; break;
  }
  schedule();
};

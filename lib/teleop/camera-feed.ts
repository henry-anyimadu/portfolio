// Puts one camera on screen. Renders in a worker through OffscreenCanvas when
// the browser supports it, otherwise on the main thread with the same code.
import { CameraView, type FramePose, type Overlay } from './render';
import type { ToRender } from './render.worker';
import { spawnWorker } from './spawn-worker';
import type { CameraId, RenderModel } from './types';

export class CameraFeed {
  readonly canvas: HTMLCanvasElement;
  readonly offThread: boolean;
  private worker: Worker | null = null;
  private view: CameraView | null = null;
  private readonly observers: { disconnect(): void }[] = [];
  private lastSeq = -1;
  private lastOverlay = '';
  private frame: FramePose | null = null;
  private overlay: Overlay = { targets: null, pad: null, hand: null };

  constructor(container: HTMLElement, model: RenderModel, camera: CameraId, private readonly priority: 1 | 2, assetBase = '/teleop') {
    // A fresh canvas per feed: a canvas can hand control to a worker only once.
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'block size-full';
    container.prepend(this.canvas);
    const dpr = window.devicePixelRatio || 1;
    this.offThread = typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in this.canvas;
    if (this.offThread) {
      const off = this.canvas.transferControlToOffscreen();
      this.worker = spawnWorker(`${assetBase}/workers/render.js`);
      this.post({ t: 'init', canvas: off, model, camera, dpr, priority }, [off]);
    } else {
      this.view = new CameraView(this.canvas, model, camera, dpr);
    }
    const ro = new ResizeObserver(() => {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (this.worker) this.post({ t: 'size', w, h });
      else this.view?.setSize(w, h);
    });
    ro.observe(this.canvas);
    const io = new IntersectionObserver(([e]) => {
      if (this.worker) this.post({ t: 'visible', visible: e.isIntersecting });
      else if (this.view) this.view.visible = e.isIntersecting;
    });
    io.observe(this.canvas);
    this.observers.push(ro, io);
  }

  private post(m: ToRender, transfer: Transferable[] = []) {
    this.worker?.postMessage(m, transfer);
  }

  /** Call every animation frame with the newest frame and overlay; sends only what changed. */
  push(frame: FramePose | null, overlay: Overlay) {
    const key = `${overlay.pad}|${overlay.hand}|${overlay.targets ? [...overlay.targets.left, ...overlay.targets.right].map(v => v.toFixed(4)).join() : ''}`;
    if (this.worker) {
      if (frame && frame.frameSeq !== this.lastSeq) {
        this.lastSeq = frame.frameSeq;
        this.post({ t: 'frame', frame: { frameSeq: frame.frameSeq, bodyPose: Float32Array.from(frame.bodyPose), camPos: frame.camPos, camMat: Array.from(frame.camMat) } });
      }
      if (key !== this.lastOverlay) {
        this.lastOverlay = key;
        this.post({ t: 'overlay', overlay: { ...overlay, targets: overlay.targets && { left: [...overlay.targets.left], right: [...overlay.targets.right] } } });
      }
      return;
    }
    this.frame = frame;
    this.overlay = overlay;
    this.view?.draw(this.frame, this.overlay, this.priority);
  }

  dispose() {
    this.observers.forEach(o => o.disconnect());
    this.worker?.terminate();
    this.view?.dispose();
    this.canvas.remove();
  }
}

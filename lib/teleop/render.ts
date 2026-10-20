// Renders a camera feed: the scene snapshot carried by the newest VideoFrame,
// seen from that camera. The operator-side overlays (where you are steering,
// which pad to touch) are drawn on top with zero latency, so the gap between
// intention and image stays visible.
import * as THREE from 'three';
import type { CameraId, RenderModel } from './types';
import type { V3 } from './wire';

/** The parts of a VideoFrame the renderer needs. */
export type FramePose = { frameSeq: number; bodyPose: ArrayLike<number>; camPos: V3; camMat: ArrayLike<number> };

export type Overlay = { targets: { left: V3; right: V3 } | null; pad: string | null; hand: 'left' | 'right' | null };

export class CameraView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bodies: THREE.Group[] = [];
  private readonly targetMarkers: Record<'left' | 'right', THREE.Mesh>;
  private readonly padRing: THREE.Mesh;
  private readonly pads = new Map<string, V3>();
  private shownSeq = -1;
  private lastOverlay = '';
  private needsResize = true;
  visible = true;
  // Adaptive budget. The command stream and the network share this thread,
  // so a slow GPU must cost image quality, never control latency.
  private drawMs = 4;
  private lastDraw = 0;
  private pixelRatio: number;
  private readonly maxRatio: number;
  stats = { drawMs: 0, pixelRatio: 1, intervalMs: 0 };
  private disposed = false;

  private size = { w: 0, h: 0 };

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, model: RenderModel, readonly id: CameraId, devicePixelRatio: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.maxRatio = Math.min(1.5, devicePixelRatio || 1);
    this.pixelRatio = this.maxRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x1e1e17, 1);
    this.scene.fog = new THREE.Fog(0x1e1e17, 2.2, 7);
    this.camera = new THREE.PerspectiveCamera(model.cameras[id].fovy, 16 / 9, 0.02, 30);
    this.camera.matrixAutoUpdate = false;

    this.scene.add(new THREE.HemisphereLight(0xf3eee6, 0x2a2a20, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1.2, -0.8, 3);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x989fb7, 0.5);
    fill.position.set(-1.5, 1.2, 1.5);
    this.scene.add(fill);

    const geometries = model.meshes.map(m => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.vert, 3));
      g.setIndex(new THREE.BufferAttribute(m.face, 1));
      g.computeVertexNormals();
      return g;
    });
    for (let b = 0; b < model.nbody; b++) {
      const grp = new THREE.Group();
      grp.matrixAutoUpdate = false;
      this.bodies.push(grp);
      this.scene.add(grp);
    }
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    const material = (rgba: number[]) => {
      const key = rgba.map(v => v.toFixed(3)).join();
      if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({
        color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2], THREE.SRGBColorSpace), roughness: 0.62, metalness: 0.12,
        transparent: rgba[3] < 1, opacity: rgba[3],
      }));
      return materials.get(key)!;
    };
    for (const g of model.geoms) {
      let geo: THREE.BufferGeometry;
      const [a, b, c] = g.size;
      switch (g.type) {
        case 'mesh': geo = geometries[g.mesh]; break;
        case 'box': geo = new THREE.BoxGeometry(2 * a, 2 * b, 2 * c); break;
        case 'sphere': geo = new THREE.SphereGeometry(a, 20, 14); break;
        case 'cylinder': geo = new THREE.CylinderGeometry(a, a, 2 * b, 40).rotateX(Math.PI / 2); break;
        case 'capsule': geo = new THREE.CapsuleGeometry(a, 2 * b, 6, 16).rotateX(Math.PI / 2); break;
        case 'plane': geo = new THREE.PlaneGeometry(40, 40); break; // infinite in MuJoCo; fog hides the edge
        default: continue;
      }
      const mesh = new THREE.Mesh(geo, material(g.rgba));
      mesh.position.set(...g.pos);
      mesh.quaternion.set(g.quat[1], g.quat[2], g.quat[3], g.quat[0]);
      this.bodies[g.body].add(mesh);
    }
    // World body never moves.
    this.bodies[0].matrix.identity();

    const markerMat = new THREE.MeshBasicMaterial({ color: 0x989fb7, transparent: true, opacity: 0.85, depthTest: false });
    const ringGeo = new THREE.TorusGeometry(0.022, 0.0035, 8, 40);
    this.targetMarkers = { left: new THREE.Mesh(ringGeo, markerMat), right: new THREE.Mesh(ringGeo, markerMat) };
    for (const m of Object.values(this.targetMarkers)) {
      m.renderOrder = 10;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), markerMat);
      dot.renderOrder = 10;
      m.add(dot);
      this.scene.add(m);
    }
    this.padRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 8, 48), new THREE.MeshBasicMaterial({ color: 0xf3eee6, transparent: true, opacity: 0.9 }));
    this.scene.add(this.padRing);
    for (const p of model.pads) this.pads.set(p.name, p.pos);
  }

  /** Draw the newest frame. Returns false if there is nothing to show yet. */
  draw(frame: FramePose | null, overlay: Overlay, priority: 1 | 2 = 1): 'drawn' | 'skipped' | 'idle' {
    if (this.disposed || !this.visible || !frame) return 'idle';
    const t0 = performance.now();
    // Keep rendering under roughly a third of the thread: wait ~2x the last draw cost.
    const interval = Math.max(0, this.drawMs * 2 * priority - 8);
    if (t0 - this.lastDraw < interval) return 'skipped';
    // Render only when something on screen changed: a new frame, or the
    // operator's own overlay. Idle views cost nothing.
    const key = `${overlay.pad}|${overlay.hand}|${overlay.targets ? [...overlay.targets.left, ...overlay.targets.right].map(v => v.toFixed(4)).join() : ''}`;
    const resized = this.resize();
    if (frame.frameSeq === this.shownSeq && key === this.lastOverlay && !resized) return 'idle';
    this.lastOverlay = key;
    if (frame.frameSeq !== this.shownSeq) {
      const p = frame.bodyPose;
      const q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let b = 1; b < this.bodies.length; b++) {
        const o = 7 * b;
        v.set(p[o], p[o + 1], p[o + 2]);
        q.set(p[o + 4], p[o + 5], p[o + 6], p[o + 3]);
        this.bodies[b].matrix.compose(v, q, one);
        this.bodies[b].matrixWorldNeedsUpdate = true;
      }
      const m = frame.camMat, c = frame.camPos;
      this.camera.matrix.set(m[0], m[1], m[2], c[0], m[3], m[4], m[5], c[1], m[6], m[7], m[8], c[2], 0, 0, 0, 1);
      this.camera.matrixWorldNeedsUpdate = true;
      this.shownSeq = frame.frameSeq;
    }
    for (const side of ['left', 'right'] as const) {
      const mk = this.targetMarkers[side];
      mk.visible = !!overlay.targets;
      if (overlay.targets) {
        mk.position.set(...overlay.targets[side]);
        mk.lookAt(new THREE.Vector3().setFromMatrixPosition(this.camera.matrix)); // face the camera
        (mk.material as THREE.MeshBasicMaterial).opacity = overlay.hand && overlay.hand !== side ? 0.45 : 0.9;
      }
    }
    const pad = overlay.pad ? this.pads.get(overlay.pad) : undefined;
    this.padRing.visible = !!pad;
    if (pad) this.padRing.position.set(pad[0], pad[1], pad[2] - 0.022);
    this.renderer.render(this.scene, this.camera);
    const took = performance.now() - t0;
    this.lastDraw = t0;
    this.drawMs = this.drawMs * 0.8 + took * 0.2;
    this.adapt();
    this.stats = { drawMs: this.drawMs, pixelRatio: this.pixelRatio, intervalMs: interval };
    return 'drawn';
  }

  private adapt() {
    const next = this.drawMs > 10 ? Math.max(0.5, this.pixelRatio - 0.25)
      : this.drawMs < 3 ? Math.min(this.maxRatio, this.pixelRatio + 0.25) : this.pixelRatio;
    if (next !== this.pixelRatio) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.needsResize = true;
    }
  }

  /** CSS size of the view. Works for OffscreenCanvas too, which has no layout of its own. */
  setSize(w: number, h: number) {
    if (w === this.size.w && h === this.size.h) return;
    this.size = { w, h };
    this.needsResize = true;
  }

  private resize(): boolean {
    if (!this.needsResize) return false;
    const { w, h } = this.size;
    if (!w || !h) return false;
    this.needsResize = false;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    return true;
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
    this.renderer.dispose();
  }
}

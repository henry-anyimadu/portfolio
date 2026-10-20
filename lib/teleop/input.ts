// Operator input: keyboard, a USB foot pedal (which reports itself as a key or
// a gamepad button), and gamepads. Produces hand velocities and the deadman.
import type { V3 } from './wire';

export type InputSample = {
  deadman: boolean;
  left: V3; // m/s
  right: V3;
  source: 'keyboard' | 'gamepad' | 'none';
  estop: boolean; // edge: pressed since last sample
};

export const KEYMAP = {
  deadman: ['Space', 'KeyB'], // most foot pedals ship mapped to a key; B is a common default
  estop: ['Escape'],
  fine: ['ShiftLeft', 'ShiftRight'],
  left: { '+x': 'KeyW', '-x': 'KeyS', '+y': 'KeyA', '-y': 'KeyD', '+z': 'KeyE', '-z': 'KeyQ' },
  right: { '+x': 'KeyI', '-x': 'KeyK', '+y': 'KeyJ', '-y': 'KeyL', '+z': 'KeyO', '-z': 'KeyU' },
} as const;

const SPEED = 0.22; // m/s at full deflection
const FINE = 0.3;
const DEADZONE = 0.15;

export class OperatorInput {
  private readonly down = new Set<string>();
  private estopLatch = false;
  private gamepadEstopWasDown = false;
  private readonly abort = new AbortController();

  constructor(private readonly target: Window) {
    const opts = { signal: this.abort.signal };
    target.addEventListener('keydown', e => this.onKey(e, true), opts);
    target.addEventListener('keyup', e => this.onKey(e, false), opts);
    // Losing focus must release the deadman: never leave a key "stuck" down.
    target.addEventListener('blur', () => this.down.clear(), opts);
    target.document.addEventListener('visibilitychange', () => this.down.clear(), opts);
  }

  private onKey(e: KeyboardEvent, isDown: boolean) {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
    const relevant = isRelevant(e.code);
    if (!relevant) return;
    if (e.code === 'Space') e.preventDefault(); // don't scroll the page under the operator
    if (isDown) {
      if ((KEYMAP.estop as readonly string[]).includes(e.code)) this.estopLatch = true;
      this.down.add(e.code);
    } else this.down.delete(e.code);
  }

  sample(): InputSample {
    const estop = this.estopLatch;
    this.estopLatch = false;
    const pad = activeGamepad();
    if (pad) {
      const ax = (i: number) => (Math.abs(pad.axes[i] ?? 0) > DEADZONE ? pad.axes[i] : 0);
      const btn = (i: number) => pad.buttons[i]?.value ?? 0;
      const estopDown = btn(1) > 0.5;
      const padEstop = estopDown && !this.gamepadEstopWasDown;
      this.gamepadEstopWasDown = estopDown;
      const keyDeadman = KEYMAP.deadman.some(k => this.down.has(k));
      return {
        deadman: btn(0) > 0.5 || keyDeadman,
        left: [-ax(1) * SPEED, -ax(0) * SPEED, (btn(4) - btn(6)) * SPEED],
        right: [-ax(3) * SPEED, -ax(2) * SPEED, (btn(5) - btn(7)) * SPEED],
        source: 'gamepad',
        estop: estop || padEstop,
      };
    }
    const k = (code: string) => (this.down.has(code) ? 1 : 0);
    const scale = SPEED * (KEYMAP.fine.some(c => this.down.has(c)) ? FINE : 1);
    const hand = (m: Record<string, string>): V3 => [
      (k(m['+x']) - k(m['-x'])) * scale,
      (k(m['+y']) - k(m['-y'])) * scale,
      (k(m['+z']) - k(m['-z'])) * scale,
    ];
    const deadman = KEYMAP.deadman.some(c => this.down.has(c));
    return { deadman, left: hand(KEYMAP.left), right: hand(KEYMAP.right), source: this.down.size ? 'keyboard' : 'none', estop };
  }

  dispose() {
    this.abort.abort();
  }
}

function isRelevant(code: string): boolean {
  return (
    (KEYMAP.deadman as readonly string[]).includes(code) ||
    (KEYMAP.estop as readonly string[]).includes(code) ||
    (KEYMAP.fine as readonly string[]).includes(code) ||
    Object.values(KEYMAP.left).includes(code as never) ||
    Object.values(KEYMAP.right).includes(code as never)
  );
}

function activeGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const p of navigator.getGamepads()) if (p && p.connected && p.mapping === 'standard') return p;
  return null;
}

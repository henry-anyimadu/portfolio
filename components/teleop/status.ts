import { Mode } from '@/lib/teleop/wire';
import type { Severity } from '@/lib/teleop/station';

// Safety colours, taken from the paintings' palette rather than pure RGB, but
// still the usual convention: green moves, ochre waits, terracotta stopped.
// Colour is never the only signal: every state also has a label and a glyph.
export const tone = {
  go: '#7d9a6a',
  wait: '#c4923d',
  stop: '#b4553f',
  idle: '#989fb7',
} as const;

export type Tone = keyof typeof tone;

export function modeTone(m: Mode): Tone {
  switch (m) {
    case Mode.ACTIVE: return 'go';
    case Mode.ARMED: case Mode.HOLD: return 'wait';
    case Mode.SAFE_STOP: case Mode.FAULT: case Mode.ESTOP: return 'stop';
    default: return 'idle';
  }
}

export function severityTone(s: Severity): Tone {
  return s === 'critical' ? 'stop' : s === 'warning' ? 'wait' : s === 'ok' ? 'go' : 'idle';
}

export const glyph: Record<Tone, string> = { go: '▶', wait: '❚❚', stop: '■', idle: '○' };

export function fmtMs(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

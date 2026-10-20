'use client';

import { FaultCode, Mode } from '@/lib/teleop/wire';
import { FAULT_LABEL, MODE_LABEL, type Snapshot, type Station } from '@/lib/teleop/station';
import { KEYMAP } from '@/lib/teleop/input';
import { cn } from '@/lib/utils';
import { glyph, modeTone, severityTone, tone } from './status';

const LADDER: { mode: Mode; what: string }[] = [
  { mode: Mode.DISARMED, what: 'Parked at rest' },
  { mode: Mode.ARMED, what: 'Waiting for deadman' },
  { mode: Mode.ACTIVE, what: 'You are driving' },
  { mode: Mode.HOLD, what: 'Frozen in place' },
  { mode: Mode.SAFE_STOP, what: 'Retracting' },
  { mode: Mode.FAULT, what: 'Needs a look' },
  { mode: Mode.ESTOP, what: 'Latched stop' },
];

const ROBOT_ACTIONS = new Set(['Arm', 'Acknowledge', 'Clear E-stop']);

export const heading = 'text-sm leading-[1.4] font-semibold text-olive';
const button = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-4 text-sm font-medium transition-[background-color,opacity,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ink active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none';
export const primaryButton = cn(button, 'bg-ink text-cream hover:bg-olive');
export const quietButton = cn(button, 'border border-ink/25 bg-transparent text-ink hover:bg-ink/6');

// The biography panel's treatment from the home page: translucent cream, serif
// for what a person reads, sans for what a person scans.
export function ControlPanel({ station, snap }: { station: Station; snap: Snapshot }) {
  const running = snap.phase === 'running';
  const a = snap.attention;
  const at = severityTone(a.severity);
  const m = snap.mode;
  const silent = running && snap.robotSilentMs > 400;
  const armed = m === Mode.ARMED || m === Mode.ACTIVE || m === Mode.HOLD;
  const ep = snap.current;
  const dist = snap.state?.episodeDistM ?? 0;
  const startDist = 0.3;

  return (
    <section aria-label="Robot control" className="w-full rounded-xs border border-white/62 bg-cream/85 px-[1.6rem] pt-[1.5rem] pb-[1.6rem] text-ink shadow-[0_6px_30px_rgb(30_30_23/7%)] backdrop-blur-[20px] phone:px-[1.3rem]">
      <div role="status" aria-live="polite" className="relative pl-4">
        <span aria-hidden="true" className="absolute top-1 bottom-1 left-0 w-[3px]" style={{ background: tone[at] }} />
        <p className="font-title text-[1.3rem] leading-[1.2] font-semibold tracking-[-.02em] text-pretty">{a.title}</p>
        <p className="mt-2 font-title text-[.9375rem] leading-[1.55] text-pretty text-ink/85">{a.detail}</p>
        {/* Arm, acknowledge and clear live with the robot controls below; one button per action. */}
        {a.action && !ROBOT_ACTIONS.has(a.action.label) && (
          <button type="button" onClick={a.action.run} className={cn(primaryButton, 'mt-4')}>{a.action.label}</button>
        )}
      </div>

      <div className="mt-[1.6rem]">
        <h3 className={heading}>Robot</h3>
        <ol className="mt-3 grid list-none grid-cols-2 gap-x-4 gap-y-[.55rem] p-0" aria-label="Robot modes">
          {LADDER.map(({ mode, what }) => {
            const current = running && !silent && mode === m;
            const t = modeTone(mode);
            return (
              <li key={mode} aria-current={current ? 'step' : undefined} className={cn('flex items-start gap-2 transition-opacity duration-200', !current && 'opacity-45')}>
                <span aria-hidden="true" className="mt-[.3rem] size-2.5 shrink-0" style={{ background: current ? tone[t] : 'transparent', boxShadow: `inset 0 0 0 1.5px ${tone[t]}` }} />
                <span>
                  <span className={cn('block text-sm leading-[1.35]', current ? 'font-semibold' : 'font-medium')}>{MODE_LABEL[mode]}</span>
                  <span className="block text-[.75rem] leading-[1.35] text-neutral-600">{what}</span>
                </span>
              </li>
            );
          })}
        </ol>
        {silent && <p className="mt-3 text-[.8125rem] text-neutral-700">Mode unknown: no state from the robot for {(snap.robotSilentMs / 1000).toFixed(1)} s.</p>}
        {snap.faults.length > 0 && (
          <p className="mt-3 text-[.8125rem] leading-normal" style={{ color: tone.stop }}>
            Active: {snap.faults.filter(f => f !== FaultCode.NONE).map(f => FAULT_LABEL[f]).join(', ')}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {m === Mode.ESTOP
            ? <button type="button" className={primaryButton} disabled={!running} onClick={station.clearEstop}>Clear E-stop</button>
            : m === Mode.FAULT
              ? <button type="button" className={primaryButton} disabled={!running} onClick={station.ackFault}>Acknowledge</button>
              : armed
                ? <button type="button" className={quietButton} disabled={!running} onClick={station.disarm}>Disarm</button>
                : <button type="button" className={primaryButton} disabled={!running || m !== Mode.DISARMED} onClick={station.arm}>Arm</button>}
          <button
            type="button"
            onClick={station.estop}
            disabled={!running || m === Mode.ESTOP}
            className={cn(button, 'ml-auto min-w-[8.5rem] font-semibold tracking-wide text-white uppercase hover:brightness-110')}
            style={{ background: tone.stop }}
            aria-keyshortcuts="Escape"
          >
            E-stop <kbd className="font-mono text-[11px] font-normal normal-case opacity-80">Esc</kbd>
          </button>
        </div>
      </div>

      <div className="mt-[1.6rem]">
        <h3 className={heading}>Operator</h3>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="grid size-7 place-items-center font-mono text-[10px] text-ink" style={{ background: snap.input.deadman ? tone.go : 'transparent', boxShadow: `inset 0 0 0 1.5px ${snap.input.deadman ? tone.go : '#1e1e1766'}` }}>
              {snap.input.deadman ? glyph.go : ''}
            </span>
            <span>
              <span className="block text-sm font-medium">Deadman {snap.input.deadman ? 'held' : 'released'}</span>
              <span className="block text-[.75rem] text-neutral-600">
                {snap.autopilot ? 'Scripted operator is driving' : snap.input.source === 'gamepad' ? 'Gamepad: hold A' : 'Hold Space, or a pedal mapped to B'}
              </span>
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[.8125rem] select-none">
            <input
              type="checkbox"
              className="size-4 cursor-pointer accent-[#1e1e17]"
              checked={snap.autopilot}
              disabled={!running}
              onChange={e => station.setAutopilot(e.target.checked)}
            />
            Autopilot
          </label>
        </div>
        <KeyLegend />
      </div>

      <div className="mt-[1.6rem]">
        <h3 className={heading}>Episode</h3>
        {ep ? (
          <div className="mt-3">
            <p className="text-sm font-medium">{ep.task.label}</p>
            <div className="mt-2 h-1.5 w-full bg-ink/10" role="progressbar" aria-label="Distance to the pad" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 * Math.max(0, 1 - dist / startDist))}>
              <div className="h-full transition-[width] duration-200" style={{ width: `${Math.max(2, 100 * Math.max(0, 1 - dist / startDist))}%`, background: tone.go }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[.75rem] text-neutral-600">
              <span className="font-mono tabular-nums">{(dist * 100).toFixed(1)} cm to go</span>
              <button type="button" className="cursor-pointer text-ink underline-offset-3 hover:underline" onClick={station.abortTask}>Abort</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[.8125rem] text-neutral-700">{snap.tasks[0] ? `Next: ${snap.tasks[0].label}` : 'Queue empty.'}</p>
            <button type="button" className={quietButton} disabled={!running || !snap.tasks.length || m === Mode.ESTOP || m === Mode.FAULT} onClick={() => station.startTask()}>Start</button>
          </div>
        )}
      </div>
    </section>
  );
}

function KeyLegend() {
  const key = (code: string) => code.replace(/^Key/, '');
  const row = (label: string, map: Record<string, string>) => (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[.75rem] text-neutral-600">{label}</span>
      <span className="flex gap-1">
        {(['+x', '-x', '+y', '-y', '-z', '+z'] as const).map(dir => (
          <kbd key={dir} title={`${dir}`} className="grid h-6 min-w-6 place-items-center border border-ink/20 bg-white/40 px-1 font-mono text-[11px]">{key(map[dir])}</kbd>
        ))}
      </span>
    </div>
  );
  return (
    <details className="mt-3 text-[.8125rem]">
      <summary className="cursor-pointer text-neutral-700 select-none">Keys and gamepad</summary>
      <div className="mt-3 grid gap-1.5">
        {row('Left', KEYMAP.left)}
        {row('Right', KEYMAP.right)}
        <p className="mt-1 text-[.75rem] leading-normal text-neutral-600">
          Forward, back, left, right, down, up, as seen from the head camera. Shift for fine moves.
          Gamepad: sticks move the hands, bumpers and triggers move them up and down, A is the deadman, B is E-stop.
        </p>
      </div>
    </details>
  );
}

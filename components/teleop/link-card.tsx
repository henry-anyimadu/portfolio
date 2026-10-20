'use client';

import type { Snapshot } from '@/lib/teleop/station';
import { cn } from '@/lib/utils';
import { Sparkline } from './sparkline';
import { fmtMs, tone } from './status';

// A project-card-shaped summary of the link: the numbers an operator would
// glance at before blaming themselves for a clumsy move.
export function LinkCard({ snap, className }: { snap: Snapshot; className?: string }) {
  const m = snap.metrics;
  const c = snap.conditions;
  const running = snap.phase === 'running';
  const degraded = c.down || c.latencyMs > 100 || c.lossPct > 5;
  const rows: [string, string][] = [
    ['Command to video', `${fmtMs(m.cmdToVideo.p50)} p50 · ${fmtMs(m.cmdToVideo.p95)} p95`],
    ['Round trip', fmtMs(m.rtt.p50)],
    ['State frames lost', `${m.stateLossPct.toFixed(1)}%`],
    ['Emulated link', c.down ? 'cut' : `${c.latencyMs} ms ±${c.jitterMs}, ${c.lossPct}% loss`],
  ];
  return (
    <figure className={cn('m-0 flex flex-col rounded-[3px] border border-white/55 bg-stone/92 p-2 text-ink shadow-[0_8px_26px_rgb(30_30_23/10%),inset_0_1px_0_rgb(255_255_255/20%)]', className)}>
      <div className="flex aspect-video flex-col justify-between bg-ink px-4 pt-3 pb-3 text-stone">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-sky">command to video, ms</span>
          {running && <span style={{ color: degraded ? tone.wait : tone.go }}>{c.down ? 'link cut' : degraded ? 'degraded' : 'nominal'}</span>}
        </div>
        <Sparkline values={m.cmdToVideo.values} label="Command to video latency, recent samples" />
        <dl className="m-0 grid gap-[.2rem] text-[.75rem]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-stone/60">{k}</dt>
              <dd className="m-0 font-mono tabular-nums">{running ? v : '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="flex flex-col gap-[.45rem] px-[.35rem] pt-[.6rem] pb-[.35rem]">
        <span className="flex items-center justify-between font-mono text-xs leading-none">03<span className="text-ink/60">Operator link</span></span>
        <span className="text-base leading-tight font-medium tracking-[-.025em]">Latency and loss</span>
      </figcaption>
    </figure>
  );
}

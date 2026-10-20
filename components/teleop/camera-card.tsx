'use client';

import { useEffect, useRef } from 'react';
import { CameraFeed } from '@/lib/teleop/camera-feed';
import type { Station, Snapshot } from '@/lib/teleop/station';
import { MODE_LABEL, HOLD_LABEL } from '@/lib/teleop/station';
import type { CameraId } from '@/lib/teleop/types';
import { Mode } from '@/lib/teleop/wire';
import { cn } from '@/lib/utils';
import { fmtMs, glyph, modeTone, tone } from './status';

const STALE_MS = 300;

type Props = {
  station: Station;
  snap: Snapshot;
  camera: CameraId;
  number: string;
  title: string;
  primary?: boolean;
  className?: string;
  children?: React.ReactNode; // shown in the image area before the session runs
};

// Styled after the project cards on the home page: a stone card with the
// image in an ink well, a mono number and a title underneath.
export function CameraCard({ station, snap, camera, number, title, primary, className, children }: Props) {
  const well = useRef<HTMLDivElement>(null);
  const model = snap.model;

  useEffect(() => {
    if (!well.current || !model) return;
    // ?video=off: bench mode for slow, GPU-less test machines. Telemetry still flows.
    if (new URLSearchParams(window.location.search).get('video') === 'off') return;
    const feed = new CameraFeed(well.current, model, camera, primary ? 1 : 2);
    let raf = 0;
    const loop = () => {
      const r = station.frames[camera];
      const s = station.getSnapshot();
      const task = s.current?.task;
      const f = r?.frame;
      feed.push(
        f ? { frameSeq: f.frameSeq, bodyPose: f.bodyPose, camPos: [f.camPos?.x ?? 0, f.camPos?.y ?? 0, f.camPos?.z ?? 0], camMat: f.camMat } : null,
        { targets: s.mode === Mode.ACTIVE || s.mode === Mode.ARMED ? station.opTargets : null, pad: task?.pad ?? null, hand: task?.hand ?? null },
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); feed.dispose(); };
  }, [station, model, camera, primary]);

  const running = snap.phase === 'running';
  const age = snap.metrics.frameAge[camera];
  const fps = snap.metrics.fps[camera];
  const noSignal = running && !Number.isFinite(age);
  const stale = running && Number.isFinite(age) && age > STALE_MS;
  const t = modeTone(snap.mode);
  const showMode = primary && running && snap.robotSilentMs < 400;

  return (
    <figure className={cn('m-0 rounded-[3px] border border-white/55 bg-stone/92 p-2 text-ink shadow-[0_8px_26px_rgb(30_30_23/10%),inset_0_1px_0_rgb(255_255_255/20%)]', className)}>
      <div
        className="relative aspect-video overflow-hidden bg-ink"
        style={primary && running ? { boxShadow: `inset 0 0 0 3px ${tone[t]}` } : undefined}
      >
        <div ref={well} className={cn('size-full transition-[opacity,filter] duration-300', (noSignal || !running) && 'opacity-0', stale && 'opacity-60 grayscale')} />
        {showMode && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1.5 font-mono text-xs tracking-wide text-ink uppercase" style={{ background: tone[t] }} role="status" aria-live="polite">
            <span aria-hidden="true">{glyph[t]}</span>
            {MODE_LABEL[snap.mode]}
            {snap.mode === Mode.HOLD && snap.holdReason ? <span className="normal-case opacity-80">· {HOLD_LABEL[snap.holdReason]}</span> : null}
          </div>
        )}
        {running && (
          <div className="absolute top-3 right-3 font-mono text-[11px] text-cream/85 tabular-nums">
            {Number.isFinite(age) ? `${fmtMs(age)} old · ${fps} fps` : ''}
          </div>
        )}
        {(noSignal || stale) && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-1 bg-ink/80 px-5 py-3 text-center text-cream">
              <span className="font-mono text-sm tracking-wide uppercase" style={{ color: tone.stop }}>{noSignal ? 'No signal' : 'Image stale'}</span>
              <span className="text-xs text-stone">{noSignal ? 'No frames from this camera.' : `Last image is ${fmtMs(age)} old. Do not trust this view.`}</span>
            </div>
          </div>
        )}
        {!running && <div className="absolute inset-0">{children}</div>}
      </div>
      <figcaption className="flex flex-col gap-[.45rem] px-[.35rem] pt-[.6rem] pb-[.35rem]">
        <span className="flex items-center justify-between font-mono text-xs leading-none">
          {number}
          <span className="text-ink/60">{camera === 'head' ? 'Torso mount, 78° fov' : 'Fixed, 45° fov'}</span>
        </span>
        <span className="text-base leading-tight font-medium tracking-[-.025em]">{title}</span>
      </figcaption>
    </figure>
  );
}

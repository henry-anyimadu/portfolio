'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { usePaintingRotation } from '@/components/use-painting-rotation';
import { Station } from '@/lib/teleop/station';
import { CameraCard } from './camera-card';
import { ControlPanel } from './control-panel';
import { DetailPanel } from './detail-panel';
import { LinkCard } from './link-card';
import { fmtMs, tone } from './status';

// Same quiet text links as the home page footer.
const footerLink = 'relative inline-flex min-h-11 items-center gap-[.35rem] py-2 text-xs leading-[1.4] text-white after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-320 hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky motion-reduce:after:transition-none';

export default function TeleopPage() {
  const [station] = useState(() => new Station('/teleop'));
  const snap = useSyncExternalStore(station.subscribe, station.getSnapshot, station.getSnapshot);
  const { painting, isChanging, loadError, cycle } = usePaintingRotation();

  useEffect(() => () => station.dispose(), [station]);

  const begin = (autopilot: boolean) => {
    station.setAutopilot(autopilot);
    station.start();
  };

  const running = snap.phase === 'running';
  const silent = running && snap.robotSilentMs > 400;

  return (
    <main className="relative isolate min-h-svh w-full overflow-clip bg-stone pb-4">
      <div className="fixed inset-0 -z-1 overflow-hidden" aria-hidden="true">
        <img
          className={`block size-full origin-center object-cover select-none [transform:scale(1.04)] transition-opacity duration-500 ${painting?.crop ?? 'opacity-0'}`}
          src={painting?.src}
          alt=""
          width={painting?.width}
          height={painting?.height}
          fetchPriority="high"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/10 to-ink/45" />
      </div>

      <header className="flex items-end justify-between gap-8 px-12 pt-[1.6rem] pb-[1.8rem] text-white compact:flex-col compact:items-start compact:gap-4 compact:px-6 compact:pt-5">
        <div>
          <a href="/" className={footerLink}><ArrowLeft size={13} aria-hidden="true" />Henry Anyimadu</a>
          <h1 className="mt-1 w-fit max-w-full font-title text-[clamp(3.4rem,5.2vw,5.4rem)] leading-[.94] font-semibold tracking-[-.055em] compact:text-[clamp(2.9rem,8vw,4.4rem)] phone:text-[clamp(2.6rem,12.5vw,3.6rem)]">
            <span className="block">G1 Teleop</span>
            <span className="mt-[.04em] block">Station.</span>
          </h1>
        </div>
        <dl className="m-0 grid grid-cols-[auto_auto] gap-x-5 gap-y-1 pb-1 font-mono text-xs text-white/90 [text-shadow:0_1px_8px_rgb(30_30_23/45%)] compact:pb-0">
          <dt className="text-white/70">Robot link</dt>
          <dd className="m-0 tabular-nums">
            {!running ? 'not connected' : silent ? <span style={{ color: '#f0b8a8' }}>silent {fmtMs(snap.robotSilentMs)}</span> : `${fmtMs(snap.metrics.rtt.p50)} round trip`}
          </dd>
          <dt className="text-white/70">Control plane</dt>
          <dd className="m-0">{snap.cloudUp ? 'reachable' : <span style={{ color: '#f0d29c' }}>unreachable</span>}</dd>
          <dt className="text-white/70">Running</dt>
          <dd className="m-0">{snap.model ? `${snap.model.agentVersion} · ${snap.model.modelHash}` : '—'}</dd>
        </dl>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] items-start gap-8 px-12 compact:grid-cols-1 compact:gap-6 compact:px-6 phone:px-4">
        {/* On narrow screens this wrapper dissolves so the control panel can sit right under the main view. */}
        <div className="grid gap-8 compact:contents">
          <CameraCard station={station} snap={snap} camera="head" number="01" title="Head camera" primary className="compact:order-1">
            <StartScreen phase={snap.phase} stage={snap.bootStage} error={snap.error} onStart={begin} />
          </CameraCard>
          <div className="grid grid-cols-2 gap-8 px-[4%] compact:order-3 compact:px-0 phone:grid-cols-1 phone:gap-6">
            <CameraCard station={station} snap={snap} camera="workcell" number="02" title="Workcell camera" className="[transform:rotate(-.8deg)] compact:transform-none motion-reduce:transform-none" />
            <LinkCard snap={snap} className="[transform:rotate(.7deg)] compact:transform-none motion-reduce:transform-none" />
          </div>
        </div>
        <div className="compact:order-2"><ControlPanel station={station} snap={snap} /></div>
      </div>

      <div className="mt-10 px-12 compact:mt-6 compact:px-6 phone:px-4">
        <DetailPanel station={station} snap={snap} />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-4 px-12 compact:flex-col compact:items-start compact:gap-0 compact:px-6">
        <div className="flex flex-wrap items-center gap-x-5">
          {painting && <a className={footerLink} href={painting.url} target="_blank" rel="noopener noreferrer" aria-label={`About the painting: ${painting.title}, by ${painting.artist} (opens in a new tab)`}>{painting.credit}<ArrowUpRight size={13} aria-hidden="true" /></a>}
          <button type="button" disabled={isChanging} onClick={cycle} className={`${footerLink} cursor-pointer border-0 bg-transparent disabled:cursor-wait disabled:opacity-65`}>
            {isChanging ? 'Loading painting' : loadError ? 'Try another painting' : 'Change painting'}<ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5">
          <a className={footerLink} href="https://github.com/google-deepmind/mujoco_menagerie/tree/main/unitree_g1" target="_blank" rel="noopener noreferrer">Unitree G1 model, MuJoCo Menagerie<ArrowUpRight size={13} aria-hidden="true" /></a>
          <a className={footerLink} href="https://github.com/henry-anyimadu/portfolio/tree/main/lib/teleop" target="_blank" rel="noopener noreferrer">Source<ArrowUpRight size={13} aria-hidden="true" /></a>
        </div>
      </footer>
    </main>
  );
}

function StartScreen({ phase, stage, error, onStart }: { phase: string; stage: string; error: string; onStart: (autopilot: boolean) => void }) {
  return (
    <div className="grid size-full place-items-center bg-ink px-6 text-center text-stone">
      <div className="max-w-md">
        {phase === 'booting' ? (
          <>
            <p className="font-mono text-sm text-sky" role="status">{stage}…</p>
            <p className="mt-3 text-[.8125rem] text-stone/70">First load fetches the physics engine and the robot description, about 14 MB.</p>
          </>
        ) : (
          <>
            <p className="font-title text-[1.35rem] leading-[1.3] text-cream">A simulated Unitree G1 on a test stand, reaching for pads on a table.</p>
            <p className="mt-3 text-[.8125rem] leading-[1.6] text-stone/75">
              Drive both arms with the keyboard or a gamepad, or let the scripted operator drive while you break the network and the hardware underneath it.
            </p>
            {phase === 'error' && <p className="mt-3 text-[.8125rem]" style={{ color: tone.stop }} role="alert">{error}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => onStart(false)} className="inline-flex min-h-11 cursor-pointer items-center bg-cream px-5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sky">
                {phase === 'error' ? 'Try again' : 'Start session'}
              </button>
              <button type="button" onClick={() => onStart(true)} className="inline-flex min-h-11 cursor-pointer items-center border border-stone/40 px-5 text-sm text-stone transition-colors duration-200 hover:bg-stone/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-sky">
                Watch the autopilot
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowUpRight, ArrowRight, Maximize2, Minimize2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { usePaintingRotation } from '@/components/use-painting-rotation';
import { AboutPanel } from '@/components/about-panel';
import { ProjectGallery } from '@/components/project-gallery';
import { ProjectCaseStudy } from '@/components/project-case-study';
import { advanceSpring, atRest, cameraTarget, clamp, nextView, normalizePoint, type Point, type Spring, type ViewAction, type ViewMode } from '@/lib/landscape-motion';
import { projects, projectForPanel, triggerForPanel, type Panel } from '@/lib/projects';

export default function LandscapeExperience() {
  const { painting, isChanging, loadError, cycle } = usePaintingRotation();
  const scene = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const projectField = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLButtonElement>(null);
  const focus = useRef<Point>({ x: 0, y: 0 });
  const currentMode = useRef<ViewMode>('overview');
  const activePointer = useRef<number | null>(null);
  const keyboardPress = useRef<string | null>(null);
  const wake = useRef<() => void>(() => {});
  const [mode, setMode] = useState<ViewMode>('overview');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>({ kind: 'project', id: projects[0].id });
  const selectedProject = projectForPanel(panel);
  const inspecting = mode !== 'overview';

  const send = useCallback((action: ViewAction) => {
    const next = nextView(currentMode.current, action);
    currentMode.current = next;
    setMode(next);
    wake.current();
  }, []);

  const reset = useCallback(() => {
    activePointer.current = null;
    keyboardPress.current = null;
    focus.current = { x: 0, y: 0 };
    send('reset');
  }, [send]);

  useEffect(() => {
    const root = scene.current;
    const artwork = image.current;
    if (!root || !artwork) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = preference.matches;
    let bounds = root.getBoundingClientRect();
    let frame = 0;
    let previous = 0;
    let alive = true;
    let x: Spring = { value: 0, velocity: 0 };
    let y: Spring = { value: 0, velocity: 0 };
    let scale: Spring = { value: 1.04, velocity: 0 };

    const tick = (time: number) => {
      frame = 0;
      if (!alive || document.hidden) return;
      const dt = previous ? (time - previous) / 1000 : 1 / 60;
      previous = time;
      const point = reduced && currentMode.current === 'overview' ? { x: 0, y: 0 } : focus.current;
      const target = cameraTarget(currentMode.current, point, bounds.width, bounds.height);
      if (reduced) {
        x = { value: target.x, velocity: 0 };
        y = { value: target.y, velocity: 0 };
        scale = { value: target.scale, velocity: 0 };
      } else {
        x = advanceSpring(x, target.x, dt);
        y = advanceSpring(y, target.y, dt);
        scale = advanceSpring(scale, target.scale, dt);
      }
      // Translation never exceeds the currently scaled image's overscan, even
      // when a gesture reverses before the zoom spring settles.
      const edgeX = Math.max(0, (scale.value - 1) * bounds.width / 2 - 1);
      const edgeY = Math.max(0, (scale.value - 1) * bounds.height / 2 - 1);
      const px = clamp(x.value, -edgeX, edgeX);
      const py = clamp(y.value, -edgeY, edgeY);
      artwork.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${scale.value})`;
      // The cards share the camera's clock at a shallower depth. Their hit
      // targets stay stable relative to one another; no extra render loop.
      if (projectField.current) {
        projectField.current.style.setProperty('--cards-x', `${px * .65}px`);
        projectField.current.style.setProperty('--cards-y', `${py * .65}px`);
      }
      const settled = reduced || (atRest(x, target.x) && atRest(y, target.y) && atRest(scale, target.scale, 0.0001));
      if (!settled) frame = requestAnimationFrame(tick);
      else previous = 0;
    };
    const schedule = () => {
      if (alive && !frame && !document.hidden) frame = requestAnimationFrame(tick);
    };
    wake.current = schedule;
    const resize = new ResizeObserver(() => {
      bounds = root.getBoundingClientRect();
      schedule();
    });
    resize.observe(root);
    const onPreference = () => { reduced = preference.matches; schedule(); };
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0; reset(); }
      else schedule();
    };
    const onBlur = () => reset();
    preference.addEventListener('change', onPreference);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      preference.removeEventListener('change', onPreference);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      wake.current = () => {};
    };
  }, [reset]);

  const updateFocus = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' && activePointer.current !== event.pointerId) return;
    const bounds = scene.current?.getBoundingClientRect();
    if (!bounds) return;
    focus.current = normalizePoint({ x: event.clientX, y: event.clientY }, bounds);
    wake.current();
  };
  const begin = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || activePointer.current !== null) return;
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFocus(event);
    send('press');
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    send('release');
  };
  const leave = () => {
    if (activePointer.current === null && currentMode.current === 'overview') {
      focus.current = { x: 0, y: 0 };
      wake.current();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      keyboardPress.current = event.key;
      send('press');
    }
    const direction: Record<string, Point> = { ArrowLeft: { x: -.15, y: 0 }, ArrowRight: { x: .15, y: 0 }, ArrowUp: { x: 0, y: -.15 }, ArrowDown: { x: 0, y: .15 } };
    if (direction[event.key] && currentMode.current !== 'overview') {
      event.preventDefault();
      focus.current = { x: clamp(focus.current.x + direction[event.key].x, -1, 1), y: clamp(focus.current.y + direction[event.key].y, -1, 1) };
      wake.current();
    }
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === keyboardPress.current) {
      event.preventDefault();
      keyboardPress.current = null;
      send('release');
    }
  };
  const toggleView = () => {
    focus.current = { x: 0, y: .35 };
    send('toggle');
    if (currentMode.current === 'latched') surface.current?.focus({ preventScroll: true });
  };

  return (
    <Dialog open={panelOpen} triggerId={triggerForPanel(panel)} onOpenChange={(open) => { reset(); setPanelOpen(open); }}>
      <main
        ref={scene}
        className="group/landscape relative isolate grid min-h-[max(64rem,100svh)] w-full grid-cols-[minmax(0,1fr)_minmax(24rem,27rem)_minmax(0,1fr)] grid-rows-[auto_1fr] items-start overflow-clip bg-stone compact:flex compact:min-h-svh compact:flex-col compact:items-stretch compact:pb-4"
        data-inspecting={inspecting}
        data-project-open={panelOpen}
        onPointerMove={updateFocus}
        onPointerLeave={leave}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !panelOpen) { event.preventDefault(); reset(); }
        }}
      >
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <img
            ref={image}
            className={`block size-full origin-center object-cover select-none [transform:scale(1.04)] will-change-transform motion-reduce:will-change-auto ${painting?.crop ?? 'opacity-0'}`}
            src={painting?.src}
            alt=""
            width={painting?.width}
            height={painting?.height}
            fetchPriority="high"
            draggable={false}
          />
        </div>
        <button
          ref={surface}
          className="absolute inset-0 z-2 size-full cursor-zoom-in rounded-none border-0 bg-transparent p-0 select-none [touch-action:pan-y_pinch-zoom] [-webkit-touch-callout:none] focus-visible:outline-1 focus-visible:-outline-offset-12 focus-visible:outline-cream focus-visible:shadow-[inset_0_0_0_13px_rgb(30_30_23/25%)] group-data-[inspecting=true]/landscape:cursor-grab group-data-[inspecting=true]/landscape:touch-pinch-zoom group-data-[inspecting=true]/landscape:active:cursor-grabbing"
          type="button"
          aria-label={painting ? `Explore ${painting.title}` : 'Explore the painting'}
          aria-describedby="landscape-instructions"
          aria-pressed={inspecting}
          onPointerDown={begin}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onClick={(event) => {
            // Virtual clicks support a persistent view without a timed gesture.
            if (event.detail === 0 && keyboardPress.current === null) send('toggle');
          }}
          onBlur={() => { keyboardPress.current = null; send('release'); }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="sr-only">{painting ? `${painting.title}, by ${painting.artist}. ${painting.description}` : 'Painting loads here.'}</span>
        </button>
        <div className="pointer-events-none relative z-3 col-span-full px-12 pt-[2.6rem] pb-[1.8rem] transition-[opacity,transform] duration-560 ease-[cubic-bezier(.2,.8,.2,1)] group-data-[inspecting=true]/landscape:-translate-y-[18px] group-data-[inspecting=true]/landscape:opacity-0 compact:px-6 compact:pt-8 compact:pb-[1.6rem] phone:pt-[1.7rem] motion-reduce:translate-none motion-reduce:transition-none">
          <h1 className="w-fit max-w-full font-title text-[clamp(4.4rem,6.5vw,6.8rem)] leading-[.94] font-semibold tracking-[-.055em] not-italic compact:text-[clamp(3.25rem,8vw,5rem)] phone:text-[clamp(2.8rem,13.3vw,4.5rem)] phone:leading-[.96]">
            <span className="block">Henry</span>
            <span className="mt-[.04em] block">Anyimadu.</span>
          </h1>
        </div>
        <AboutPanel inspecting={inspecting} />
        <ProjectGallery fieldRef={projectField} inspecting={inspecting} onSelect={id => setPanel({ kind: 'project', id })} />
        <div className="absolute right-12 bottom-6 left-12 z-4 flex items-center justify-between gap-4 compact:relative compact:inset-auto compact:mx-6 compact:mt-4 compact:group-data-[inspecting=true]/landscape:fixed compact:group-data-[inspecting=true]/landscape:inset-x-6 compact:group-data-[inspecting=true]/landscape:bottom-5 compact:group-data-[inspecting=true]/landscape:m-0">
          <div className="flex flex-wrap items-center gap-x-5 compact:flex-col compact:items-start">
          {painting && <a
            className="relative inline-flex min-h-11 items-center gap-[.35rem] py-2 text-xs leading-[1.4] text-white after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-320 hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none"
            href={painting.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`About the painting: ${painting.title}, by ${painting.artist} (opens in a new tab)`}
          >{painting.credit}<ArrowUpRight size={13} aria-hidden="true" /></a>}
          <button
            type="button"
            disabled={isChanging}
            onClick={() => { reset(); cycle(); }}
            className="group/change relative inline-flex min-h-11 cursor-pointer items-center gap-2 border-0 bg-transparent py-2 text-xs text-white after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 hover:after:scale-x-100 focus-visible:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky active:opacity-65 disabled:cursor-wait disabled:opacity-65 motion-reduce:after:transition-none"
          >
            {isChanging ? 'Loading painting' : loadError ? 'Try another painting' : 'Change painting'}
            <ArrowRight size={14} aria-hidden="true" className="transition-transform duration-300 group-hover/change:translate-x-1 motion-reduce:transition-none" />
          </button>
          </div>
          <button
            className="relative inline-flex min-h-11 cursor-pointer items-center gap-[.65rem] focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-sky border-0 bg-transparent py-2 text-sm leading-[1.4] font-normal text-white after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-320 hover:after:scale-x-100 focus-visible:after:scale-x-100 active:opacity-65 motion-reduce:after:transition-none"
            type="button"
            onClick={toggleView}
            aria-pressed={inspecting}
            aria-describedby="landscape-instructions"
          >
            <span>{inspecting ? 'Return to overview' : 'Look closer'}</span>
            <span className="grid size-6 place-items-center" aria-hidden="true">
              <Maximize2 size={18} strokeWidth={1.5} className="col-start-1 row-start-1 transition-[transform,opacity] duration-300 group-data-[inspecting=true]/landscape:scale-[.55] group-data-[inspecting=true]/landscape:rotate-45 group-data-[inspecting=true]/landscape:opacity-0 motion-reduce:transition-none" />
              <Minimize2 size={18} strokeWidth={1.5} className="col-start-1 row-start-1 scale-[.55] -rotate-45 opacity-0 transition-[transform,opacity] duration-300 group-data-[inspecting=true]/landscape:scale-100 group-data-[inspecting=true]/landscape:rotate-0 group-data-[inspecting=true]/landscape:opacity-100 motion-reduce:transition-none" />
            </span>
          </button>
        </div>
        <span className="sr-only" role="status">{loadError ? 'The painting could not load. Try another painting.' : painting ? `${painting.title}, by ${painting.artist}.` : ''}</span>
        <span id="landscape-instructions" className="sr-only">Hold the landscape to zoom, then release to return. You can also activate Look closer to keep the detail view open. In detail view, move your pointer or use the arrow keys to pan. Press Escape or activate Return to overview to leave.</span>
        <span className="sr-only" role="status" aria-live="polite">{mode === 'latched' ? 'Detail view. Arrow keys move the view. Escape returns to overview.' : ''}</span>
      </main>
      <ProjectCaseStudy project={selectedProject} />
    </Dialog>
  );
}

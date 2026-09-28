'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import { ArrowUpRight, CalendarDays, FileText, Layers } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { DialogTrigger } from '@/components/ui/dialog';
import { projects, type ProjectId, type ProjectLink } from '@/lib/projects';
import { cn } from '@/lib/utils';

const carouselOptions = {
  align: 'start' as const,
  containScroll: 'trimSnaps' as const,
  duration: 26,
  breakpoints: {
    '(min-width: 1025px)': { active: false },
    '(prefers-reduced-motion: reduce)': { duration: 0 },
  },
};

// IDs keep positions stable when entries are reordered. The type requires an
// explicit position for each new card instead of wrapping over an existing one.
const positions = {
  'racing-telemetry': 'right-[5.5%] top-[9%] [--card-angle:1.2deg]',
  'racing-firmware': 'left-[5.5%] top-[28%] [--card-angle:-1.2deg]',
  fabric: 'right-[4%] top-[36%] [--card-angle:.7deg]',
  'african-architecture': 'left-[4%] top-[51%] [--card-angle:.8deg]',
  resume: 'right-[6%] top-[65%] [--card-angle:-1deg]',
  'workday-calendar': 'left-[5.5%] top-[74%] [--card-angle:-.6deg]',
} as const satisfies Record<ProjectId, string>;

const stepClasses = 'static m-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-sky size-11 min-w-11 transform-none rounded-full border-white/42 bg-transparent p-0 text-white shadow-none hover:bg-cream/14 hover:text-white disabled:opacity-35';

type Props = {
  fieldRef: RefObject<HTMLDivElement | null>;
  inspecting: boolean;
  onSelect: (id: ProjectId) => void;
};

export function ProjectGallery({ fieldRef, inspecting, onSelect }: Props) {
  const [carousel, setCarousel] = useState<CarouselApi>();
  const [projectIndex, setProjectIndex] = useState(0);

  useEffect(() => {
    if (!carousel) return;
    const onCarouselSelect = () => setProjectIndex(carousel.selectedScrollSnap());
    onCarouselSelect();
    carousel.on('select', onCarouselSelect);
    carousel.on('reInit', onCarouselSelect);
    return () => {
      carousel.off('select', onCarouselSelect);
      carousel.off('reInit', onCarouselSelect);
    };
  }, [carousel]);

  return (
    <div
      ref={fieldRef}
      role="group"
      aria-label="Selected projects"
      inert={inspecting}
      className="pointer-events-none absolute inset-0 z-3 transition-opacity duration-240 ease-out group-data-[inspecting=true]/landscape:opacity-0 group-data-[project-open=true]/landscape:opacity-45 compact:pointer-events-auto compact:relative compact:inset-auto compact:mx-auto compact:w-[min(40rem,100%)] motion-reduce:transition-none"
    >
      <Carousel
        className="static compact:relative [&_[data-slot=carousel-content]]:overflow-visible compact:[&_[data-slot=carousel-content]]:overflow-hidden compact:[&_[data-slot=carousel-content]]:pt-[.55rem] compact:[&_[data-slot=carousel-content]]:pb-[.7rem] compact:[&_[data-slot=carousel-content]]:pl-6 compact:[&_[data-slot=carousel-content]]:[touch-action:pan-y_pinch-zoom]"
        opts={carouselOptions}
        setApi={setCarousel}
        aria-label="Selected projects"
      >
        <CarouselContent className="m-0 block compact:flex compact:gap-0 compact:[touch-action:pan-y_pinch-zoom]">
          {projects.map((project, index) => {
            const direct = 'kind' in project;
            const Card = direct ? 'a' : DialogTrigger;
            const link: ProjectLink | undefined = direct ? project : undefined;
            const cover = direct ? link?.cover?.trim() : project.cover.preview;
            const Icon = link?.icon ? { fabric: Layers, resume: FileText, calendar: CalendarDays }[link.icon] : ArrowUpRight;
            return (
            <CarouselItem
              key={project.id}
              aria-label={`${index + 1} of ${projects.length}`}
              style={{ '--depth': [.8, 1.4, 1.05][index % 3] } as CSSProperties}
              className={cn(
                'pointer-events-none absolute w-[clamp(13rem,17vw,16rem)] p-0 [transform:translate3d(calc(var(--cards-x,0px)*var(--depth,1)),calc(var(--cards-y,0px)*var(--depth,1)),0)] compact:relative compact:inset-auto compact:m-0 compact:w-auto compact:max-w-76 compact:flex-[0_0_79%] compact:transform-none compact:pr-4 compact:[--card-angle:0deg] compact:even:[--card-angle:.5deg] motion-reduce:transform-none',
                positions[project.id],
              )}
            >
              <Card
                id={`project-${project.id}`}
                {...(direct
                  ? { href: project.href, target: '_blank', rel: 'noopener noreferrer' }
                  : { onClick: () => onSelect(project.id) })}
                aria-label={direct ? `${project.title} (opens in a new tab)` : `Open ${project.title} case study`}
                className="group/card pointer-events-auto block w-full cursor-pointer rounded-[3px] border border-white/55 bg-stone/80 p-2 text-left text-ink shadow-[0_8px_26px_rgb(30_30_23/10%),inset_0_1px_0_rgb(255_255_255/20%)] backdrop-blur-[14px] [transform:rotate(var(--card-angle,0deg))] transition-[transform,background-color,box-shadow] duration-360 ease-[cubic-bezier(.18,.8,.22,1)] hover:bg-stone/95 pointer-fine:hover:[transform:translate3d(0,-6px,0)_rotate(0)] pointer-fine:hover:shadow-[0_18px_36px_rgb(30_30_23/19%)] focus-visible:bg-stone/96 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white focus-visible:[transform:translate3d(0,-6px,0)_rotate(0)] active:[transform:translate3d(0,-2px,0)_rotate(0)_scale(.985)] group-data-[inspecting=true]/landscape:pointer-events-none compact:transform-none compact:[touch-action:pan-y_pinch-zoom] compact:focus-visible:transform-none motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:focus-visible:transform-none motion-reduce:active:transform-none"
              >
                <span className="block h-[clamp(5rem,7vw,6.5rem)] overflow-hidden bg-ink compact:h-28">
                  {cover ? <img
                    src={cover}
                    alt=""
                    width={!direct ? project.cover.width : undefined}
                    height={!direct ? project.cover.height : undefined}
                    draggable={false}
                    className="block size-full object-cover object-[center_38%] opacity-80 saturate-50 transition-[opacity,filter,transform] duration-500 ease-[cubic-bezier(.18,.8,.22,1)] pointer-fine:group-hover/card:scale-[1.025] pointer-fine:group-hover/card:opacity-100 pointer-fine:group-hover/card:saturate-100 group-focus-visible/card:scale-[1.025] group-focus-visible/card:opacity-100 group-focus-visible/card:saturate-100 motion-reduce:scale-100 motion-reduce:transition-none"
                  /> : <span className="grid size-full place-items-center bg-olive/40 text-stone">
                    <Icon size={42} strokeWidth={1} aria-hidden="true" className="transition-transform duration-500 pointer-fine:group-hover/card:scale-105 motion-reduce:transition-none" />
                  </span>}
                </span>
                <span className="flex flex-col gap-[.45rem] px-[.35rem] pt-[.6rem] pb-[.35rem] compact:min-h-16">
                  <span className="flex items-center justify-between font-mono text-xs leading-none">
                    {project.number}
                    <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" className="transition-transform duration-250 pointer-fine:group-hover/card:translate-x-0.5 pointer-fine:group-hover/card:-translate-y-0.5 motion-reduce:translate-none motion-reduce:transition-none" />
                  </span>
                  <span className="text-base leading-tight font-medium tracking-[-.025em] text-balance">{project.title}</span>
                </span>
              </Card>
            </CarouselItem>
          ); })}
        </CarouselContent>
        <div className="hidden items-center justify-between gap-4 px-6 py-[.1rem] text-white compact:flex">
          <span className="font-mono text-xs tabular-nums" aria-live="polite" aria-atomic="true">
            <span className="sr-only">Project </span>{String(projectIndex + 1).padStart(2, '0')}
            <span aria-hidden="true"> / </span><span className="sr-only"> of </span>{String(projects.length).padStart(2, '0')}
          </span>
          <div className="flex gap-1">
            <CarouselPrevious className={stepClasses} aria-label="Previous project" />
            <CarouselNext className={stepClasses} aria-label="Next project" />
          </div>
        </div>
      </Carousel>
    </div>
  );
}

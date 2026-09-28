import { ArrowUpRight, X } from 'lucide-react';
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Project } from '@/lib/projects';

export function ProjectCaseStudy({ project }: { project: Project | undefined }) {
  return (
    <DialogContent
      showCloseButton={false}
      className="top-auto right-6 bottom-6 left-auto block max-h-[calc(100dvh-3rem)] w-[min(47rem,calc(100%-3rem))] max-w-none translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none border border-border bg-ink px-10 pt-8 pb-10 text-stone shadow-[0_20px_80px_rgb(30_30_23/20%)] ring-0 outline-none data-open:animate-panel-enter data-closed:animate-panel-leave sm:max-w-none phone:right-[.7rem] phone:bottom-[.7rem] phone:max-h-[calc(100dvh-1.4rem)] phone:w-[calc(100%-1.4rem)] phone:px-6 phone:pt-[1.4rem] phone:pb-6 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
    >
      {project && <>
        <div className="mb-[2.3rem] flex items-center justify-between font-mono text-sm text-sky phone:mb-[1.7rem]">
          <span>Project {project.number}</span>
          <DialogClose aria-label="Close case study" className="-my-2 -mr-[.6rem] grid size-11 cursor-pointer place-items-center border-0 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-sky bg-transparent p-0 text-stone transition-colors duration-160 hover:bg-stone/9 motion-reduce:transition-none">
            <X size={21} strokeWidth={1.5} />
          </DialogClose>
        </div>
        <DialogTitle className="font-title text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-semibold tracking-[-.03em]">{project.title}</DialogTitle>
        <DialogDescription className="mt-6 max-w-xl text-base leading-[1.65] text-stone">{project.summary}</DialogDescription>
        <img className="mt-8 block h-auto max-h-84 w-full bg-white/4 object-contain phone:mt-6" src={project.cover.src} alt={project.cover.alt} width={project.cover.width} height={project.cover.height} />
        <ul className="m-0 flex list-none flex-wrap gap-x-[1.3rem] gap-y-2 border-b border-border px-0 py-[1.1rem] text-sm text-sky" aria-label="Tools and methods">
          {project.tools.map(tool => <li key={tool}>{tool}</li>)}
        </ul>
        <div className="my-8 grid gap-[1.8rem]">
          {project.sections.map(section => <section key={section.title} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-6 phone:grid-cols-1 phone:gap-2">
            <h2 className="text-sm leading-[1.7] font-normal text-sky">{section.title}</h2>
            <p className="text-base leading-[1.7]">{section.body}</p>
          </section>)}
        </div>
        <a className="group/source inline-flex min-h-11 items-center gap-[1.2rem] border-b border-stone py-[.6rem] text-sm" href={project.link.href} target="_blank" rel="noopener noreferrer">
          {project.link.label}
          <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" className="transition-transform duration-220 group-hover/source:translate-x-0.5 group-hover/source:-translate-y-0.5 motion-reduce:translate-none motion-reduce:transition-none" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </>}
    </DialogContent>
  );
}

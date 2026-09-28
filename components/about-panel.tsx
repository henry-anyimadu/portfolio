import { experience } from '@/lib/experience';

export function AboutPanel({ inspecting }: { inspecting: boolean }) {
  return (
    <section
      aria-label="About"
      inert={inspecting}
      className="relative z-4 col-start-2 mt-2 mb-24 w-full rounded-xs border border-white/62 bg-cream/85 px-[1.8rem] pt-[1.65rem] pb-[1.8rem] text-ink shadow-[0_6px_30px_rgb(30_30_23/7%)] backdrop-blur-[20px] transition-[opacity,transform] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] group-data-[inspecting=true]/landscape:pointer-events-none group-data-[inspecting=true]/landscape:translate-y-2 group-data-[inspecting=true]/landscape:opacity-0 compact:mx-auto compact:mt-0 compact:mb-6 compact:w-[min(30rem,calc(100%-3rem))] compact:px-[1.45rem] compact:py-[1.4rem] phone:bg-cream/88 narrow:w-[calc(100%-2rem)] narrow:p-5 motion-reduce:translate-none motion-reduce:transition-none"
    >
      <p className="mt-[1.05rem] font-title font-normal text-[.9375rem] leading-[1.6] text-pretty phone:leading-[1.55]">
        Hi, I'm Henry, a software and product engineer building the future of human-agent interaction.
        <br /> <br />
        My work spans across the software stack, from embedded systems, full-stack web applications, and user experience design.
        <br /> <br />
        I'm currently in my final year at Washington University in St. Louis, studying Computer Science, Business, and Human-Computer Interaction.
        <br /> <br />
        When I'm not on my laptop or in the FSAE garage, I'm usually either sim racing, golfing, or in the gym. I'm also an avid fan of motorsports and soccer.
      </p>
      <section className="mt-[1.8rem] phone:mt-[1.4rem]" aria-labelledby="experience-heading">
        <h3 id="experience-heading" className="text-sm leading-[1.4] font-semibold text-olive">Experience</h3>
        <ul className="mt-4 grid list-none gap-5 p-0 phone:mt-[.85rem]">
          {experience.map(job => (
            <li key={job.company} className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-4">
              <div>
                <span className="block text-sm leading-[1.45] font-medium">{job.company}</span>
                <span className="mt-[.2rem] block text-[.8125rem] leading-normal text-neutral-600">{job.role}</span>
              </div>
              <span className="grid size-9 place-items-center overflow-hidden rounded-lg bg-white">
                <img src={job.logo} alt="" width={36} height={36} className={job.company === 'Fabric' ? 'size-full object-contain' : 'size-full object-contain p-1'} />
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-5 -ml-3 flex flex-wrap gap-x-1" aria-label="Social links">
        {[
          { label: 'LinkedIn', href: 'https://linkedin.com/in/anyimadu', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
          { label: 'GitHub', href: 'https://github.com/henry-anyimadu', path: 'M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.652.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
        ].map(link => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.label} (opens in a new tab)`}
            className="inline-flex size-11 items-center justify-center text-neutral-600 transition-[color,transform] duration-200 hover:-translate-y-0.5 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-600 motion-reduce:transform-none motion-reduce:transition-none"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true"><path d={link.path} /></svg>
          </a>
        ))}
      </div>
    </section>
  );
}

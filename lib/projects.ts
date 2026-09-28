export type Project = Readonly<{
  id: string;
  number: string;
  title: string;
  category: string;
  summary: string;
  tools: readonly string[];
  cover: { src: string; preview: string; alt: string; width: number; height: number };
  sections: readonly { title: string; body: string }[];
  link: { label: string; href: string };
}>;

export type ProjectLink = Readonly<{
  kind: 'link';
  id: string;
  number: string;
  title: string;
  href: string;
  icon?: 'fabric' | 'resume' | 'calendar';
  // Optional image URL or /public-relative path. Takes precedence over icon.
  cover?: string;
}>;

// Keep card content separate from the scene. When adding entries, also assign
// distinct desktop positions in project-gallery.tsx; mobile uses the carousel.
export const projects = [
    // Taking out Wrapify until it meets my requirements
  // {
  //   id: 'wrapify', number: '01', title: 'Wrapify', category: 'Music / Web application',
  //   summary: 'A Spotify companion for exploring top tracks and artists, then sharing the results.',
  //   tools: ['Vue 3', 'TypeScript', 'Pinia', 'Vite'],
  //   cover: { src: '/images/wrapify.webp', preview: '/images/wrapify-preview.webp', alt: 'Wrapify artist rankings, with time-range controls and a share action.', width: 1280, height: 799 },
  //   sections: [
  //     { title: 'The idea', body: 'Give listeners a way to explore their listening data beyond an annual recap.' },
  //     { title: 'The interface', body: 'Switch between tracks and artists, choose a time range, and inspect the ranked results. A share action lets listeners take the results beyond the app.' },
  //     { title: 'The implementation', body: 'A Vue application with TypeScript, Pinia, and Vue Router. The project also includes html2canvas for image capture and Color Thief for color extraction.' },
  //   ],
  //   link: { label: 'View repository', href: 'https://github.com/henry-anyimadu/better-spotify-wrapped' },
  // },
  {
    id: 'racing-telemetry', number: '01', title: 'WashU Racing Live Telemetry', category: 'Motorsport / Live data',
    summary: 'A full-stack telemetry interface for live sensor data.',
    tools: ['Vue', 'TypeScript', 'WebSockets', 'Python'],
    cover: { src: '/images/racing-telemetry.webp', preview: '/images/racing-telemetry-preview.webp', alt: 'WashU Racing telemetry dashboard with track map, speed, throttle, and brake-pressure graphs.', width: 1280, height: 642 },
    sections: [
      { title: 'The role', body: 'As one of the Electronics and Data Acquisition Leads for WashU Racing FSAE, I am responsible for our data and telemetry pipelines, from wiring sensors to linearizing data.' },
      { title: 'At the track', body: 'An RF receiver supplies sensor readings to a Redis database. Dedicated views let race engineers inspect the vehicle through time-series graphs in real time to monitor system status.' },
      { title: 'The process', body: 'After our system wires all sensors on the car, we use CAN to send data via RF radio to a Redis database. This data is sorted and displayed on our pit wall via a web application using Vue.js.' },
    ],
    link: { label: 'View repository', href: 'https://github.com/WURacing/telemetry/tree/main/TelemetryWebApp' },
  },
    {
    kind: 'link', id: 'racing-firmware', number: '02', title: 'FSAE Firmware Code',
    href: 'https://github.com/WURacing/firmware/tree/master/2026', cover: '/images/FirmwareBoards.png',
  },
  {
    kind: 'link', id: 'fabric', number: '03', title: 'Fabric - Consumer Social Startup',
    href: 'https://whatsfabric.com', icon: 'fabric',
  },
  {
    id: 'african-architecture', number: '03', title: 'African Architecture', category: 'Interface design / iOS concept',
    summary: 'A mobile app concept for exploring architecture, inspired by the work of David Adjaye.',
    tools: ['Figma', 'Wireframes', 'Visual design'],
    cover: { src: '/images/african-architecture.webp', preview: '/images/african-architecture-preview.webp', alt: 'African Architecture mobile designs showing a globe, a list of buildings, and a building detail view.', width: 1280, height: 719 },
    sections: [
      { title: 'The starting point', body: 'The work of Ghanaian architect David Adjaye prompted an idea for an application that collects and presents his buildings.' },
      { title: 'From paper to screen', body: 'Physical sketches became digital wireframes and a mobile interface in Figma. The process explored color, typography, image treatment, and user journeys.' },
      { title: 'The result', body: 'A visual concept with location discovery, a collection of works, and detailed building pages. The original case study documents the sketches, wireframes, and final screens.' },
    ],
    link: { label: 'Read original case study', href: 'https://www.henryany.com/case-studies/african-architecture' },
  },
  {
    kind: 'link', id: 'resume', number: '04', title: 'Resume',
    href: 'https://drive.google.com/file/d/1jE4c1RIasTRvQS_LG-Tpe3XQrfkyZ4aA/view?usp=sharing', icon: 'resume',
  },
  {
    kind: 'link', id: 'workday-calendar', number: '05', title: 'Workday to Calendar Parser',
    href: 'https://parser.henryany.com', icon: 'calendar',
  },
] as const satisfies readonly (Project | ProjectLink)[];

export type ProjectId = (typeof projects)[number]['id'];
export type Panel = { kind: 'project'; id: ProjectId };

export function projectForPanel(panel: Panel): Project | undefined {
  const project = projects.find(project => project.id === panel.id);
  return project && !('kind' in project) ? project : undefined;
}

export function triggerForPanel(panel: Panel): string {
  return `project-${panel.id}`;
}

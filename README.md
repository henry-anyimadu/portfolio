# Henry Anyimadu

## Optional link-card covers

Desktop placement correction (2026-09-28): each of the six cards has its own ID-keyed position in components/project-gallery.tsx. The former modulo lookup reused project 1's position for card 6. A Record<ProjectId, string> now requires a placement for every added entry and preserves placement when entries are reordered. Desktop uses a minimum 64rem scene height for three staggered cards on either side of About. The compact carousel retains its existing layout.

In `lib/projects.ts`, `ProjectLink.cover` accepts an optional image path or URL, for example `cover: '/images/FirmwareBoards.png'`. Put local images in `public/images/`. A nonempty cover takes precedence over `icon` and uses the same crop, size, and hover treatment as case-study thumbnails on desktop and mobile. Omit the cover (or leave it blank) to show the chosen icon. If both are omitted, the card shows an external-link arrow. A cover does not change the link destination or open a case-study dialog. FSAE Firmware Code uses its existing FirmwareBoards.png as a cover.

Validation: run `npm run build` and `node node_modules/typescript/bin/tsc --noEmit` after changing this renderer or its types.

A personal landing page based on the supplied artwork brief and palette. The selected design is option B: a visible, translucent biography panel within a painted landscape, with floating project cards. The page has no navigation bar, italic type, role subheading, or expandable About link.

The title now uses a local Source Serif Pro Semibold font file. The font's internal name is SourceSerifPro-SemiBold and its OS/2 weight is 600. The font and SIL OFL license sit in public/fonts/.

## Local process

Use Node 22.13 or later. Preserve the starter dependencies and lockfile.

- Install: `npm ci`
- Preview: `npm run dev`
- Compile: `npm run build`
- Type check: `node node_modules/typescript/bin/tsc --noEmit`
- Motion tests: `node --experimental-strip-types --test tests/*.test.mjs`

The existing preview runs at http://localhost:3000/. No remote site exists yet.

## Interaction model

The server page contains a typed React client component. The component uses three explicit states: overview, held detail, and persistent detail. A pointer press enters held detail; release or cancellation returns to overview. The Look closer control enters persistent detail without a timed gesture. Arrow keys pan the persistent view. Escape restores the overview. Virtual clicks from assistive technology also support persistent detail.

The camera uses a closed-form critically damped spring. It writes transforms through refs in requestAnimationFrame, so pointer movement does not cause React renders. It stops its frame loop at rest, pauses on tab visibility loss, handles resize, and clamps translation to the current image overscan. Reduced-motion users get immediate intentional view changes with no ambient camera movement.

Pointer capture handles releases outside the scene. Pointer cancellation, keyboard release, focus loss, window blur, and tab visibility loss have explicit exit paths. Touch keeps page scroll and pinch zoom in overview; persistent detail permits two-axis pan and retains pinch zoom.

The biography is a normal section present in the initial render. It has a short serif introduction and four compact experience rows with company, role, and date. It has no click or hover gate, internal scroll area, or modal behavior. The About introduction uses local Source Serif Pro Semibold at 15px; company names are 14px, with smaller secondary role/date text. Content uses natural page flow on small screens and can grow with browser text enlargement.

Three translucent project cards share the landscape camera's frame loop at different depths. Cards accept clicks and keyboard activation; focus alone does not open a panel. Case studies retain the installed Base UI dialog through the local shadcn wrapper, including its focus scope, inert background, Escape dismissal, and trigger-specific focus return. The biography and cards become inert during landscape detail view.

At 1024px and below, the same project elements become a horizontal carousel beneath the biography. The existing shadcn/Embla carousel supplies touch gestures, click suppression during a drag, keyboard arrows, focus handling, and previous/next controls. A partial next card makes the collection visible. The position indicator follows swipe, button, and keyboard changes. The carousel is inactive on desktop and has zero-duration scroll changes under reduced motion. Desktop keeps five cards scattered around the central biography: two on the left and three on the right. Assign each new card a distinct position in components/project-gallery.tsx. No new dependency is necessary.

Add or revise projects in lib/projects.ts. The same typed record supplies the card, preview, case study, and external source link. Keep actual project details and image paths in that file; no component edit is necessary to add another project.

Revise the public experience summary in lib/experience.ts. Styling uses Tailwind CSS 4 utility classes in the scene, About, project gallery, and case study components. app/globals.css contains Tailwind imports, the font face, shared theme tokens, responsive variants, and animation definitions. The separate landscape.css stylesheet is removed. Complete utility strings remain visible to the Tailwind scanner, including the three desktop card positions. Runtime camera transforms and numeric depth variables remain ref-driven to preserve the motion behavior.

## Content and assets

The copy contains the user's name, stated interests, four experience entries, and the three selected projects. Experience names, roles, and dates come from the user-supplied /Users/henryanyimadu/Documents/Resumes/Henry_A_Resume.pdf, read on 2026-09-06. The entries are NVIDIA, WashU Racing, Boeing, and Fabric. No resume metrics, private contact details, or company source appear in this project. The resume remains outside the website; it is not a public asset.

Project evidence, read on 2026-09-06:

- Wrapify: https://github.com/henry-anyimadu/better-spotify-wrapped — README, its screenshot, and package.json support the interface and framework summary.
- WashU Racing Live Telemetry: https://github.com/WURacing/telemetry/tree/main/TelemetryWebApp — README, its screenshot, and frontend package.json support live sessions, CSV import, and interface details. The user-supplied Henry_A_Resume.pdf supports the leadership role, WebSockets, and Python. No numerical performance claims were copied.
- African Architecture: https://www.henryany.com/case-studies/african-architecture — the original text and ArchitectureHero.png support the Figma concept and design process. It is described as a concept, not a shipped iOS app.

Project images come from those public project pages. Small WebP previews load with the cards; larger versions load when a case study opens. The original downloaded PNG files remain available locally in public/images/.

Palette from the supplied swatches: stone #d1beb1, sky #989fb7, olive #51523f, ink #1e1e17, plus white and cream #f3eee6.

Original background: Pierre-Auguste Renoir, Woman with a Parasol in a Garden, 1875. Museum record: https://www.museothyssen.org/en/collection/artists/renoir-pierre-auguste/woman-parasol-garden. The visible credit links to this record.

Image source: https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir_-_Femme_avec_parasol_dans_un_jardin_-_Google_Art_Project.jpg, a public-domain reproduction from Google Art Project. Original: https://upload.wikimedia.org/wikipedia/commons/4/4b/Pierre-Auguste_Renoir_-_Femme_avec_parasol_dans_un_jardin_-_Google_Art_Project.jpg. Resize proportionally to 2400 pixels wide with Pillow LANCZOS, then save as WebP at quality 88, method 6, preserving any source ICC profile. The site asset is public/images/renoir-woman-parasol-garden.webp (2400 × 2016, 2,495,018 bytes).

Tailwind object-position utilities control the crop; the mobile crop centers on the figures. No saturation filter or tinted page overlay alters the background. Translucent panels and the temporary case-study backdrop retain their intentional surfaces. Earlier artwork assets remain unused.

## Verification

The Tailwind migration passed the production build and strict TypeScript check on 2026-09-07. All seven motion tests passed. A TypeScript-parser inventory of the component class strings passed validation against the installed Tailwind compiler, including custom responsive variants, state variants, and theme animations. The final local page and unfiltered painting returned HTTP 200. Browser QA did not run.

The revised production build and strict TypeScript check passed on 2026-09-06. All seven motion tests passed. The updated local route returned HTTP 200.

The project-card revision also passed the production build and strict TypeScript check. The page, font, all three card previews, and all three case images returned HTTP 200. The font name and 600 weight were checked directly in the font metadata. Initial card images total 81,910 bytes; full images load inside the case panels.

The option B revision passed the production build, strict TypeScript check, and all seven motion tests on 2026-09-06. The updated local page and painting returned HTTP 200. No browser QA ran for this revision.

The motion tests cover event repetition, release behavior, non-timed detail access, cancellation resets, out-of-bounds pointer capture, image coverage at three screen sizes, frame-rate consistency at 30/60/144 Hz, reversal, and suspended frames. Browser screenshots and interaction checks require an explicit browser-test request under the Sites skill and have not run.

## Publication

Experience logos (2026-09-09): the About list replaces visible dates with 36px rounded logo tiles, using company names and roles on the left. NASA follows Fabric with the user-supplied role, Geosciences Planetary Data Researcher. Existing role text and stored dates remain unchanged. Logo images have empty alt text because the adjacent company names already identify them. Assets are local in public/images/companies/.

Official logo sources: NVIDIA https://www.nvidia.com/favicon.ico; Boeing https://www.boeing.com/content/dam/boeing/v2/common/boeing-logo-blue.png; Fabric https://whatsfabric.com/apple-touch-icon.png; NASA https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo@2x.png; WashU Racing https://images.squarespace-cdn.com/content/v1/699a1fb08e5e2071974f3d71/cdb927d2-2a27-45df-a6d4-24817c5974d3/washuracing_allred.PNG?format=300w. These are identifying company marks, not public-domain artwork.

About social links (2026-09-09): LinkedIn and GitHub appear below Experience as gray SVG logos with accessible names, 44px targets, hover and keyboard focus states. URLs come from the link annotations in the supplied Henry_A_Resume.pdf. Both open in a new tab. Update these links in components/about-panel.tsx and validate with the production build. The About introduction now uses a true 400-weight Source Serif Pro file, public/fonts/source-serif-pro-regular.ttf, from Google Fonts (https://fonts.gstatic.com/s/sourceserifpro/v18/neIQzD-0qpwxpaWvjeD0X88SAOeaiXM.ttf). The title retains its separate 600-weight file.

### Direct cards — 2026-09-08

Fabric opens https://whatsfabric.com directly. Resume opens public/Henry_A_Resume.pdf, copied from the user-supplied resume. Workday to Calendar Parser opens https://parser.henryany.com. All three use native links with the same card surface, focus state, and hover motion as case-study triggers. Links open a new tab and announce that behavior. Simple icons distinguish the direct cards without unrelated project screenshots. Existing case studies retain their dialogs. All five entries float around About on desktop and use the carousel on mobile. The former automatic grid switch was removed; the production build passed after this correction.

To update the resume, replace public/Henry_A_Resume.pdf with the intended PDF. Direct entries use ProjectLink in lib/projects.ts; case studies use Project. Verify with the production build and TypeScript check.

The workspace AGENTS.md requires explicit approval before deployment or remote writes. Keep the page local until approval arrives. Then register this site once, retain its project ID in .openai/hosting.json, save the validated source, and publish through Sites at the approved access level.

## Painting rotation (2026-09-07)

### Added paintings — 2026-09-09

The active collection now includes Renoir and Knox plus Monet, Kensett, and Sorolla. Previously removed entries remain removed. Each added image uses a 3200px-long-edge WebP at quality 90, method 6. Originals were inspected, resized proportionally with Pillow LANCZOS without upscaling, and any embedded ICC profile retained. No color filters or tint adjustments were applied. Tailwind crop positions keep the main subjects visible on narrow screens. The existing random-on-load and manual cycle logic reads these entries automatically.

- Monet, The Water-Lily Pond, 1899, National Gallery NG4240: source 6000 × 5821; site 3200 × 3105. Museum: https://www.nationalgallery.org.uk/paintings/claude-monet-the-water-lily-pond. Image source: https://commons.wikimedia.org/wiki/File:Claude_Monet,_The_Water-Lily_Pond_(National_Gallery,_London).jpg.
- Sorolla, Valencian Fishermen, 1895, National Gallery L1331, on loan from Broere Charitable Foundation: source 3693 × 2737; site 3200 × 2372. Museum: https://www.nationalgallery.org.uk/paintings/joaquin-sorolla-valencian-fishermen. Image source: https://commons.wikimedia.org/wiki/File:Joaqu%C3%ADn_Sorolla_y_Bastida_-_Los_pescadores_valencianos_(1895).jpg.
- John Frederick Kensett, Lake George, 1869, Met 15.30.61: source 3811 × 2577; site 3200 × 2164. Museum: https://www.metmuseum.org/art/collection/search/11311. Original: https://images.metmuseum.org/CRDImages/ad/original/DT84.jpg.

Commons identifies the Monet and Sorolla files as faithful public-domain reproductions; museum metadata retains photographic credit notices. The Met explicitly marks its Kensett image public domain. Full image files load only when selected and decode before display.

The About copy retains the user’s wording and uses the local 600-weight serif at 15px. The footer offers a small Change painting button beside the current artwork credit. It has a 44px touch target and supports normal keyboard activation. Mobile places the credit above the button.

The typed collection in lib/paintings.ts contains Renoir, Knox, Cole, and Claude. Each page load selects a random painting, excluding the last successfully displayed painting in the same tab when session storage is available. Without storage, random selection still works. The manual button follows collection order and wraps. No timer changes the image while someone reads.

components/use-painting-rotation.ts decodes the selected image before replacing the visible source and credit together. The same image element remains in place to preserve the camera ref. A failed request leaves the previous image intact and offers Try another painting. A request counter ignores stale completions after cleanup. The first render keeps the About copy visible while the selected background loads. No background color filters or tinted overlays are applied.

Additional asset sources:
- John Knox, Landscape with Tourists at Loch Katrine, about 1815–1820. Museum: https://www.nationalgalleries.org/art-and-artists/20897. Public-domain Google Art Project reproduction: https://commons.wikimedia.org/wiki/File:John_Knox_-_Landscape_with_Tourists_at_Loch_Katrine_-_Google_Art_Project.jpg. Local WebP: 2400 × 1723.
- Thomas Cole, The Oxbow, 1836. Museum: https://www.metmuseum.org/art/collection/search/10497. Public-domain Met reproduction: https://commons.wikimedia.org/wiki/File:Cole_Thomas_The_Oxbow_(The_Connecticut_River_near_Northampton_1836).jpg. Local WebP: 2400 × 1630.
- Claude, A Seaport, 1644, NG5. Museum: https://www.nationalgallery.org.uk/paintings/claude-a-seaport. Image: https://www.nationalgallery.org.uk/server.iip?IIIF=%2Ffronts%2FN-0005-00-000072-XL-PYR.tif%2Ffull%2F%2180%2C50%2F0%2Fdefault.jpg. The museum endpoint returned 800 × 608 even when a larger size was requested. This source avoids the suspect proportions of the alternate Commons reproduction, but may look softer on large screens.

Asset process: inspect originals, resize proportionally with Pillow LANCZOS to a maximum 2400px edge without upscaling, save WebP quality 88/method 6, preserve any ICC profile. Crop through Tailwind object-position utilities only.

Validation: production build and strict TypeScript check passed; all 10 motion and rotation tests passed. The local page and four painting URLs returned HTTP 200. Browser interaction and visual checks did not run.

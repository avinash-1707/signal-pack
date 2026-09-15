# Signal Pack UI Specification

## Direction

Signal Pack is an editorial research desk, not a generic SaaS dashboard. The visual premise is simple: every recommendation visibly rests on source evidence.

## Design system

- Display: Source Serif 4 or Newsreader.
- UI/body: IBM Plex Sans.
- Evidence identifiers, timestamps, URLs: IBM Plex Mono.
- Paper `#F4F1EA`, ink `#1C1B18`, secondary ink `#69655D`, rules `#D8D2C7`.
- Verified `#285B47`, partial/inference `#A86B16`, unresolved `#A84232`, citations `#24577A`.
- Flat surfaces, 1px rules, 4-6px maximum corner radius. No gradients, metric cards, sparklines, or decorative AI imagery.

## Screens

### Intake

- Eyebrow: `PUBLIC-SOURCE LAUNCH RESEARCH`.
- Headline: `Build a creator brief pack from what can be verified.`
- Fields in this exact order: product URL, objective, audience, launch date, constraint.
- Policy line: `First-party sources preferred. No private analytics or scraped creator data.`
- Supporting method: `Evidence -> validation -> three distinct briefs -> human-approved export`.

### Live research

- Desktop split: 4-column trace rail and 8-column evidence ledger.
- Trace states are factual milestones, not an “agent thinking” animation.
- Evidence rows show ID, source type, title, concise excerpt, confidence, roles, and outbound link.
- Partial result is explicit: `One source unavailable. Continuing with reduced coverage.`

### Brief pack

- Persist the evidence rail or lower ledger section; never hide provenance behind a chat transcript.
- Render exactly three lanes: Engineer proof, Founder consequence, Practitioner reaction.
- Each lane shows hook, cited core claim, asset requirement, creator prompt, CTA, and a strong `Do not claim` block.
- An inline evidence click opens a source drawer with title, URL, retrieval time, source type, full bounded excerpt, confidence rationale, and original-source link.

### Approval/export

- Sticky document-signoff band shows citation, unique-primary-claim, and narrative-overlap validator results.
- Checkbox text: `I have reviewed these claims and constraints.`
- The owner-only export button remains disabled until both the checkbox and approval API call succeed.
- A non-owner can see the approval state but receives an owner-only explanation instead of a Sheets write action.

## Motion and accessibility

- Evidence arrivals: 180-220ms opacity plus 6px translation.
- Source drawer: 220ms contextual slide.
- Approval/export: restrained status/icon change only.
- `prefers-reduced-motion` makes transitions immediate.
- All state colors include a text label and icon; no meaning relies on color alone.

## Demo quality bar

The Loom must show: a source click, a partial source result, visibly differentiated brief lanes, and an approval gate. Cut history, dark mode, charts, asset upload, and live Sheets confirmation before cutting any of those interactions.

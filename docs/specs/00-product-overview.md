# Signal Pack

## Product summary

Signal Pack is an evidence-to-creator-brief compiler for technology product launches. A strategist supplies a product URL, target audience, and launch objective. Signal Pack gathers permitted public context, separates verified claims from inference, then produces three differentiated, source-backed creator briefs that can be exported into a launch tracker.

It is designed around a publicly observable Social Capital operating loop:

```text
product understanding -> launch narrative -> creative asset requirements
-> differentiated creator briefs -> reviewed distribution handoff
```

The product does not claim access to a creator roster, private engagement data, or Social Capital campaign analytics.

## Documentation map

`00-product-overview.md` is the product brief. Implementation contracts live in focused documents:

- `01-ui-spec.md`: screens, visual direction, UI states, and demo quality bar.
- `03-research-harness.md`: tool policy, run state machine, source handling, prompts, and validators.
- `04-api-contracts.md`: routes, request/response schemas, approval, and presenter unlock.
- `05-data-and-retention.md`: database schema, session ownership, retention, deletion, and fixture contract.
- `06-deployment.md`: framework, providers, environment, rate limits, and deployment topology.

## Why this exists

Public descriptions of Social Capital's work emphasise product understanding, researching viral examples, creating written and visual hooks, and coordinating drafts from many creators. A generic brief risks creator posts repeating the same claim. The launch team needs a fast, defensible answer to:

> Which claims are safe to make, which audience narratives are distinct, which asset role supports each narrative, and what must a creator not claim?

Signal Pack makes that handoff reviewable. It is not a generic post generator.

## Product insight

The public evidence suggests that launch performance depends on coordinated asset roles, rather than creator reach alone:

- Product proof supports credibility and retention.
- Creator-native framing supports sharing and reach.
- A concrete CTA supports clickthrough and conversion.

This is a reasoned inference, not a claim about private Social Capital operations. The product must label it as such and cite the public material supporting it.

## Target user

Primary user: a launch strategist or growth lead preparing creator distribution for a technology product launch.

Secondary user: a thinker-writer or creative lead who needs an evidence-backed first draft of creator briefs before producing copy and assets.

## Locked MVP decisions

| Decision | Choice | Why |
|---|---|---|
| Web framework | Next.js 16 App Router | Fastest path to one deployable application, server routes, streaming UI, and a polished demo. |
| Authentication | Anonymous, session-scoped public demo; no accounts | A reviewer can try the product without signup. An httpOnly signed session cookie identifies a browser for rate limits and run retrieval. |
| Model | OpenAI Responses API with `gpt-4.1-mini` | Native strict function calling and structured outputs at low prototype cost. |
| Discovery | Brave Search API | Independent search index, predictable request pricing, and public web/video/news results. |
| Export | Google Sheets | A launch tracker is naturally row-oriented and immediately understandable in a demo. |
| Deployment | Vercel | One deployable Next.js app with streaming support and no separate API service. |
| Production database | Neon Postgres | Durable run/evidence storage with a serverless connection model; use Postgres rather than SQLite because the demo is deployed. |
| Demo fixture | Cartesia public launch research | Cartesia is listed in Social Capital's public work; a checked-in fixture makes the core demo reproducible without changing web results. |

This is a prototype decision set, not a claim that these are the only production-ready choices.

## Job to be done

When I am preparing a launch, help me turn scattered public product context into distinct creator-ready brief cards, so I can coordinate credible distribution without asking every creator to repeat the same generic message.

## MVP workflow

1. User enters a product URL, launch objective, audience, optional launch date, and optional claim constraint.
2. Signal Pack discovers permitted public sources, prioritising the product's own website, documentation, blog, newsroom, and founder material.
3. The research harness extracts evidence into a source ledger. Every observation has a source URL, excerpt, retrieval time, source type, and confidence.
4. Deterministic checks remove duplicates, reject unsupported claims, and label unavailable evidence as incomplete rather than absent.
5. The model proposes three differentiated narrative lanes from the evidence.
6. The user reviews the evidence and approves the pack.
7. Signal Pack exports creator brief rows to a Google Sheets launch tracker. A later integration may hand an approved brief to Outloud for reviewed X/LinkedIn drafts.

### Demo authorization boundary

Anyone can view the static shared demo fixture. New research runs are allowed anonymously under strict session and IP limits. Google Sheets export is an owner-only demo action: it requires a presenter unlock code stored in `DEMO_EXPORT_CODE`, creates a short-lived httpOnly owner cookie, and is never exposed in a shared demo URL. This avoids giving arbitrary visitors write access to the presenter's tracker.

## Input

```text
Product URL: https://example.com/product
Launch objective: awareness | waitlist_signups | demo_requests
Audience: AI engineers and technical founders
Launch date: optional ISO date
Constraint: "Do not make unverified benchmark claims"
```

## Output

### Evidence ledger

Every item identifies its provenance and the role it supports.

```text
[E-04] First-party product page
Claim: "Real-time speech-to-speech model"
Excerpt: "..."
URL: https://example.com/product
Retrieved: 2026-09-15T12:00:00Z
Confidence: high
Roles: product_proof, authority
```

### Launch pack

The pack contains exactly three brief cards in the MVP. Each card must use a different audience lens and cannot reuse its primary claim.

```text
Lane: Engineer proof
Audience: ML engineers
Core claim: [E-04]
Hook: A technical tension drawn from evidence, not a fabricated metric
Required asset: 15-30 second product interaction or annotated screen capture
Creator prompt: Explain the implementation-relevant implication in your own voice
CTA: Read docs / try demo
Do not claim: unsupported latency, pricing, performance, or partnership details
Evidence: E-04, E-07
```

### Coverage report

The report states which public asset roles were found in this run:

- authority
- product proof
- retention asset
- creator-native narrative
- social proof
- conversion bridge

It must say "not found in this run" rather than asserting a role does not exist.

## MVP features

- Product intake form.
- Tool-trace view with search, extraction, and validation status.
- Source ledger with citations and direct links.
- Three differentiated creator briefs.
- Deterministic narrative-overlap and citation checks.
- Export approved briefs to a Google Sheets launch tracker.
- Partial-result handling when a source cannot be retrieved.

## UI and demo direction

The authoritative screen and visual specification is `01-ui-spec.md`.

The application should feel like an **editorial research desk**, not a generic AI dashboard. The visual point of view is that every creator recommendation visibly rests on evidence.

### Information hierarchy

1. Product and run status.
2. Evidence ledger.
3. Three differentiated brief lanes.
4. Human approval and export.

### Core screens

#### Intake

- Eyebrow: `PUBLIC-SOURCE LAUNCH RESEARCH`.
- Headline: `Build a creator brief pack from what can be verified.`
- One focused form: product URL, objective, audience, optional constraint.
- Policy note: `First-party sources preferred. No private analytics or scraped creator data.`
- Method note: `Evidence -> validation -> three distinct briefs -> human-approved export`.

#### Live research trace

- Desktop split view: trace on the left, evidence ledger on the right.
- Trace items are plain-language milestones, not simulated agent thinking.
- Each evidence row shows its ID, source kind, source title, excerpt, confidence, supported roles, and outbound source link.
- A source failure is visible: `One source unavailable. Continuing with reduced coverage.`

#### Brief pack

- Persistent evidence rail or lower evidence section. Provenance must not be hidden in a modal-only experience.
- Three editorial lanes: `Engineer proof`, `Founder consequence`, and `Practitioner reaction`.
- Each lane shows a large hook, inline evidence IDs, required asset, creator prompt, CTA, and a firm `Do not claim` block.
- Clicking an evidence ID opens a source detail drawer with the original excerpt, source type, confidence rationale, retrieval time, and source link.

#### Approval and export

- A document-signoff band states citation, uniqueness, and overlap-check results.
- The user must check `I have reviewed these claims and constraints` before export becomes available.
- Approval changes export state only. It must not rewrite the report or regenerate content.

### Visual system

- Display type: Source Serif 4 or Newsreader.
- UI/body type: IBM Plex Sans.
- Evidence IDs, URLs, and timestamps: IBM Plex Mono.
- Paper base: `#F4F1EA`; ink: `#1C1B18`; rules: `#D8D2C7`.
- Semantic colors only: verified `#285B47`, partial/inference `#A86B16`, unresolved `#A84232`, citations `#24577A`.
- Flat surfaces, 1px rules, square or 4-6px corners, and no gradients, metric tiles, or AI-themed decoration.
- Motion is limited to 180-220ms evidence arrivals, source-drawer transitions, and approval state changes. Respect `prefers-reduced-motion`.

### Demo quality bar

The demo must show an immediate citation-to-source interaction, visibly different brief lanes, one partial-source state, and a consequential approval gate. Persistent history, dark mode, charts, source previews, and user-uploaded asset UI are deliberately cut.

## Non-goals

- Scraping LinkedIn, X, Instagram, TikTok, or login-gated content.
- Ranking or contacting creators.
- Claiming platform-level engagement data.
- Autonomous publishing.
- Downloading third-party videos or transcripts.
- Full campaign planning, scheduling, or payment workflows.
- A multi-agent framework or durable workflow engine.

## Source and data policy

### Permitted sources

- Product/company first-party sites and public documentation.
- Search API results and snippets.
- Public pages that are accessible to the product's configured fetch policy.
- User-provided product screenshots, launch assets, or source URLs.

### Disallowed sources

- Authentication-gated pages.
- Robots-disallowed URLs.
- Private-network addresses, localhost, and non-HTTPS URLs.
- User profiles or pages collected through scraping.
- Any source that returns an unsupported content type or exceeds size limits.

### Product URL ownership and consent

The authoritative source-access and consent policy is `03-research-harness.md`.

- A user may submit a publicly accessible product URL without proving ownership; Signal Pack only researches information already publicly exposed and permitted by its fetch policy.
- The product URL is not treated as consent to crawl the full site, access accounts, or ingest private material.
- User-provided URLs that point to customer data, shared drives, authenticated pages, or third-party campaign dashboards are rejected in the MVP.
- User-uploaded assets are out of the core MVP. If the optional asset-analysis feature is later enabled, the user must attest that they own or are authorized to analyze the asset.

### Retention and deletion

The authoritative data lifecycle and cascading-deletion contract is `05-data-and-retention.md`.

- Store the run input, normalized evidence excerpts, trace metadata, and generated brief pack for 24 hours.
- Do not store raw fetched HTML after extracting the bounded excerpt.
- Do not log model prompt/completion bodies, secret values, or presenter unlock attempts.
- A protected daily cleanup job permanently deletes expired runs and dependent evidence, trace, and brief rows. Shared demo fixtures are checked-in static test data and are not user-run records.
- A visitor may delete the current browser session's runs immediately through a `Delete this session` action. The signed session cookie is cleared at the same time.

### Claim policy

- A verified fact must cite at least one evidence ID.
- A recommendation must cite the evidence that motivated it.
- An inference must be labeled as an inference.
- Search snippets may support discovery; first-party extracted content is preferred for substantive product claims.
- The final pack cannot export when it contains an unresolved citation reference.

## Product principles

1. Evidence before eloquence.
2. Public does not mean unrestricted; respect provider and publisher constraints.
3. The model proposes; deterministic code validates.
4. Surface uncertainty instead of smoothing it away.
5. Creator differentiation is a product constraint, not a stylistic preference.
6. Human approval authorizes every external side effect.

## Success criteria

The MVP succeeds when a user can complete one run for a real public product and receive:

- at least six normalized evidence items, including two first-party sources when available;
- three brief cards with distinct primary claims and audience lenses;
- zero uncited externally verifiable claims;
- a usable Google Sheets export;
- a visible tool trace and an honest partial-result state.
- the Cartesia fixture passes all brief/citation validators without calling external APIs.

## Demo scenario

Use a Social Capital public client or comparable AI company, such as Cartesia, Gamma, or Wispr Flow. Label the run as public-source research, not internal campaign analysis.

### Exact acceptance fixture

The fixture lives at `fixtures/cartesia-awareness-2026-09-15.json`; its exact schema and test contract live in `05-data-and-retention.md`. It represents this fixed input:

```text
Product URL: https://cartesia.ai/
Launch objective: awareness
Audience: AI engineers and technical founders
Constraint: Do not make claims not present in first-party evidence.
```

The fixture contains 8 sanitized, normalized evidence records, including at least 2 first-party Cartesia records and one Social Capital work reference. It must produce exactly three valid lanes with unique primary evidence IDs. Live mode may produce different results because public sources change; the fixture is used for tests, screenshots, and the Loom fallback.

Demonstrate:

1. Product URL and objective input.
2. Live research trace and evidence ledger.
3. A source click that verifies one claim.
4. Three clearly non-overlapping creator brief cards.
5. The approval gate and tracker export.
6. The limitation banner: no private platform analytics and no scraped creator data.

## 4-5 hour delivery plan

| Time | Deliverable | Can cut? |
|---|---|---|
| 0:00-0:35 | TypeScript app shell, environment validation, intake form | No |
| 0:35-1:20 | Search connector, safe fetch/extraction, evidence schema | No |
| 1:20-2:20 | Bounded tool-using harness and evidence validation | No |
| 2:20-3:05 | Brief compiler and deterministic overlap checks | No |
| 3:05-3:35 | Citation/tool-trace UI and partial failure states | No |
| 3:35-4:05 | Google Sheets export and approval gate | Export can be replaced with JSON download |
| 4:05-5:00 | Test fixture, deploy, README, short demo video | Polish only |

## 2-hour emergency version

- One search provider.
- First-party source extraction only.
- Fixed research plan rather than model-selected queries.
- Three source-backed brief cards.
- JSON/Markdown download instead of tracker export.
- One real demo run with a recorded tool trace.

## Relationship to existing work

Signal Pack is deliberately upstream of Outloud:

```text
Signal Pack: public evidence -> approved creator brief
Outloud: approved context -> voice-matched X/LinkedIn draft -> human review -> publish
```

The optional handoff should be a later phase. It must never cause a social post to be created or published without explicit review.

## References

- Social Capital home: https://socialcap.uk
- Social Capital about: https://www.sociallcapital.com/about
- Social Capital Head of Growth role: https://www.sociallcapital.com/careers/head-of-growth
- Brave Search API: https://brave.com/search/api/
- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic, Building Effective AI Agents: https://www.anthropic.com/engineering/building-effective-agents

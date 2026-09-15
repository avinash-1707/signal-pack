# Signal Pack

Signal Pack is an evidence-to-creator-brief compiler for technology product launches.

Give it a public product URL, launch objective, target audience, optional launch date, and claim constraint. Signal Pack researches permitted public sources, records what it can substantiate, and compiles exactly three differentiated creator briefs for human review.

It is designed for launch strategists, growth leads, and creative leads who need credible creator direction without asking every creator to repeat the same generic message.

## The Problem

Product context is scattered across marketing pages, documentation, launch posts, and founder material. A generic AI brief turns that material into untraceable copy, encouraging creators to repeat unsupported claims or identical angles.

Signal Pack makes the handoff reviewable:

```text
public product evidence
  -> normalized source ledger
  -> deterministic validation
  -> three distinct creator brief lanes
  -> human approval
  -> Google Sheets launch tracker
```

The product is deliberately upstream of drafting and publishing tools. It prepares an approved brief; it does not write or publish a social post without review.

## What The MVP Delivers

- Product intake for URL, objective, audience, optional launch date, and claim constraint.
- Policy-aware public-source discovery and first-party-page extraction.
- An evidence ledger with source URL, excerpt, retrieval time, source kind, confidence, and supported asset roles.
- A transparent research trace showing searches, extraction outcomes, validation, and partial-source limitations.
- Exactly three creator briefs with unique lanes, audience lenses, and primary evidence.
- Deterministic citation, required-field, and narrative-overlap validation.
- Explicit human acknowledgment before an owner-only Google Sheets export.
- A static, reproducible Cartesia fixture for tests and the shared demo.

## Product Guarantees

- **Evidence before eloquence.** Externally verifiable claims must cite evidence IDs.
- **Public is not unrestricted.** The fetcher respects HTTPS-only, public-network, robots, redirect, timeout, response-size, and content-type rules.
- **Uncertainty stays visible.** Unavailable sources are reported as `not found in this run` or partial results, never treated as proof of absence.
- **Models propose; code validates.** Model output cannot bypass schema, citation, uniqueness, or approval checks.
- **No silent external writes.** Google Sheets export requires both the reviewed pack and a short-lived owner capability.

## Explicit Non-Goals

- Scraping LinkedIn, X, Instagram, TikTok, or login-gated pages.
- Accessing creator rosters, private engagement data, or campaign analytics.
- Ranking or contacting creators.
- Downloading third-party video or transcript content.
- Autonomous publishing, campaign scheduling, payments, or full campaign management.
- Multi-agent orchestration, browser automation, vector databases, or durable workflow infrastructure for the MVP.

## Stack

| Area | Choice |
|---|---|
| Application | Next.js 16 App Router with strict TypeScript |
| Validation | Zod schemas shared across APIs, tools, and model output |
| Database | Neon Postgres |
| Discovery | Brave Search API |
| Research model | OpenRouter Chat Completions API with a configured tool-capable model |
| Export | Google Sheets service account |
| Rate limiting | Upstash Redis or Vercel KV |
| Hosting | Vercel |

## Status

Units 1 through 5 are implemented and covered by fixture-backed tests. Deployment hardening is in progress. The Cartesia demo is available without credentials; live provider verification and deployment need the configured services below. See the [build plan](docs/specs/07-build-plan.md) and [progress tracker](docs/progress-tracker.md) for the current execution state.

## Setup

### Run the fixture demo

Requirements: Node.js 20.9 or later and Corepack. The repository pins pnpm 11 in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000`. The default Cartesia report is a static, sanitized fixture and makes no provider calls.

Run all local checks with:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Configure live services

Copy the template and populate every value. Do not commit the resulting `.env.local` file.

```bash
cp .env.example .env.local
```

| Variable | Setup requirement |
|---|---|
| `BRAVE_SEARCH_API_KEY` | Create a Brave Search API credential. |
| `OPENROUTER_API_KEY` | Create an OpenRouter API key. |
| `RESEARCH_MODEL` | Choose an OpenRouter route that supports tool calling and strict JSON-schema structured output. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Create a service-account credential JSON and keep it server-side. |
| `GOOGLE_SHEET_ID` | Create one demonstration spreadsheet and share it only with that service account. |
| `DATABASE_URL` | Create a Neon Postgres database or local Postgres instance. |
| `KV_REST_API_URL` | Create an Upstash Redis or Vercel KV REST store. |
| `KV_REST_API_TOKEN` | Use the REST store token. |
| `SESSION_SIGNING_SECRET` | Generate a random secret of at least 32 characters. |
| `DEMO_EXPORT_CODE` | Set the presenter-only export unlock code. |
| `CRON_SECRET` | Generate a separate random secret for Vercel Cron. |

Apply the authoritative schema to the configured database before attempting a live run:

```bash
psql "$DATABASE_URL" -f migrations/0000_initial.sql
```

Live routes validate the complete environment before use. Start the application with `pnpm dev`, then submit a valid product URL from the intake form to begin a session-owned live run. The fixture demo and tests remain credential-free.

### Deploy to Vercel

1. Create a Vercel project connected to this repository.
2. Configure every variable above in the Vercel project environment.
3. Apply `migrations/0000_initial.sql` to the production Neon database.
4. Deploy the application. `vercel.json` schedules `GET /api/internal/purge-expired` daily; Vercel sends the configured `CRON_SECRET` as its authorization bearer token.
5. Exercise a permitted live run, confirm cross-session reads return `404`, and verify an approved owner-only Sheets export.

The cleanup endpoint deletes expired sessions; database foreign-key cascades delete all session-owned records.

### What to verify before release

- The Cartesia fixture loads on desktop and mobile without credentials.
- A live run respects robots restrictions and configured rate limits.
- A run from another browser session returns `404`.
- An approved run cannot export until the same session has the owner capability.
- Reusing one export idempotency key creates one Sheets tracker write.
- The daily Vercel Cron invocation deletes expired sessions and logs only the deletion count.

## Documentation

| Document | Purpose |
|---|---|
| [Documentation index](docs/README.md) | Complete documentation map and source-of-truth boundaries. |
| [Product overview](docs/specs/00-product-overview.md) | Users, scope, policies, success criteria, and demo scenario. |
| [UI specification](docs/specs/01-ui-spec.md) | Information hierarchy, visual system, interaction, and accessibility. |
| [Architecture](docs/specs/02-architecture.md) | Component boundaries, execution flow, security, and integration design. |
| [Research harness](docs/specs/03-research-harness.md) | Source rules, model instructions, tool budgets, and validators. |
| [API contracts](docs/specs/04-api-contracts.md) | Zod request, response, and SSE event contracts. |
| [Data and retention](docs/specs/05-data-and-retention.md) | Authoritative Postgres schema, ownership, retention, and deletion. |
| [Deployment](docs/specs/06-deployment.md) | Environment, operational limits, cleanup, and release checks. |
| [Build plan](docs/specs/07-build-plan.md) | Implementation units, dependencies, and definitions of done. |
| [Coding standards](docs/coding-standards.md) | Code organization, trust boundaries, testing, and review rules. |
| [Progress tracker](docs/progress-tracker.md) | Live implementation and external-dependency status. |

## License

No license has been selected yet.

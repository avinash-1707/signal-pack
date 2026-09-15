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

## Planned Stack

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

The product and implementation contracts are specified. Application code has not been created yet.

The build starts with application foundation and session-safe persistence while provider credentials and deployment accounts are prepared in parallel. See the [build plan](docs/specs/07-build-plan.md) and [progress tracker](docs/progress-tracker.md) for the current execution state.

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

## Implementation Prerequisites

The fixture-backed path can be built without provider credentials. Live research, persistence, export, and deployment require:

- OpenRouter API key and a model that supports tool calling plus structured outputs
- Brave Search API key
- Neon Postgres database
- Google service account with access to one demonstration spreadsheet
- Upstash Redis or Vercel KV
- Vercel project and Cron configuration

These prerequisites are tracked in [the progress tracker](docs/progress-tracker.md).

## License

No license has been selected yet.

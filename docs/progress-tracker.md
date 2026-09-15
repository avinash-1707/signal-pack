# Signal Pack Progress Tracker

**Companion docs:** [build plan](specs/07-build-plan.md), [coding standards](coding-standards.md), and the specifications listed in [the documentation index](README.md)

**Status:** Live document
**Source of truth for:** what is actually implemented, external blockers, and intentional deviations from the specifications.

## How To Update This File

The build plan defines the work; this tracker records execution against it. Update the unit table when work begins or ends. Add a log entry for meaningful progress, a discovered gap, an external status change, or a deviation from a specification.

If a change alters a product, security, retention, contract, or deployment decision, update the owning specification in the same change and link it from the log entry. Do not let implemented behavior silently diverge from the specs.

## Unit Status

| Unit | Status | Last updated | Notes |
|---|---|---|---|
| Unit 0: Accounts and local prerequisites | Not started | 2026-09-15 | Provider accounts and development credentials are required for live integration checks. |
| Unit 1: Application foundation | Done (external checks pending) | 2026-09-15 | Session-owned run routes, signed httpOnly cookies, Postgres repositories, Upstash KV limit primitives, and safe logging are implemented. Live Postgres/KV verification awaits credentials. |
| Unit 2: Evidence and safe retrieval core | Not started | 2026-09-15 | Depends on Unit 1. |
| Unit 3: Research and brief compilation | Not started | 2026-09-15 | Depends on Unit 2. |
| Unit 4: Research desk UI and live events | Not started | 2026-09-15 | Can begin fixture-first once shared contracts exist. |
| Unit 5: Approval and Google Sheets export | Not started | 2026-09-15 | Requires service-account setup for live verification. |
| Unit 6: Deployment, hardening, and demo | Not started | 2026-09-15 | Depends on all previous units. |

Use `Not started`, `In progress`, `Blocked`, `Done`, or `Done (external checks pending)`. A unit is not `Done` until its build-plan definition of done has been verified.

## External Dependencies

| Item | Status | Last updated | Notes |
|---|---|---|---|
| OpenRouter API credentials and model selection | Not started | 2026-09-15 | Required for live research and compilation only; the selected route must support tools and structured outputs. |
| Brave Search API credentials | Not started | 2026-09-15 | Required for live discovery only. |
| Neon Postgres database | Not started | 2026-09-15 | Required for deployed persistence. |
| Google Sheets service account and demo sheet | Not started | 2026-09-15 | Required for live export verification. |
| Redis/KV rate-limit store | Not started | 2026-09-15 | Required before anonymous deployed runs. |
| Vercel project and Cron configuration | Not started | 2026-09-15 | Required for deployment and retention cleanup. |

## Execution Log

Add entries newest first.

```text
### [YYYY-MM-DD] Short title
**Unit:** Unit number and name
**Type:** Progress update | Gap found | Deviation from spec | External status change
**Summary:** What changed and why it matters.
**Files/areas touched:** Concise paths or "None - external".
**Verification:** Commands run and relevant results; name any checks not run.
**Spec impact:** None, or the specification updated to reflect this change.
**Follow-ups:** Remaining work or blocker.
```

### [2026-09-15] Application foundation started
**Unit:** Unit 1: Application foundation
**Type:** Progress update
**Summary:** Created the strict Next.js App Router foundation with shared Zod API/domain/environment contracts, safe structured logging, the authoritative initial Postgres schema migration, signed session ownership, session-scoped run routes, and shared KV rate-limit primitives. Fixture tests cover strict contracts, missing environment reporting, cascading relationships, signed-cookie tamper resistance, session deletion, ownership-scoped queries, and rate-limit ordering without provider credentials.
**Files/areas touched:** `src/`, `tests/`, `migrations/`, application tooling, `.env.example`
**Verification:** `pnpm test` (8 tests), `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. The workspace explicitly rejects the optional `unrs-resolver` build and uses its fallback. Live Postgres/KV checks could not run without configured credentials.
**Spec impact:** None; implementation follows existing architecture, API, data, and deployment contracts.
**Follow-ups:** Configure Unit 0 credentials, apply the migration to local/Neon Postgres, and exercise live session ownership and KV rate limits.

### [2026-09-15] Documentation baseline established
**Unit:** Planning
**Type:** Progress update
**Summary:** Product, UI, architecture, harness, API, data lifecycle, deployment, build plan, coding standards, and execution tracking are documented. No application code has been created.
**Files/areas touched:** `docs/`
**Verification:** Documentation cross-references reviewed.
**Spec impact:** Documentation organization established; product behavior unchanged.
**Follow-ups:** Start Unit 0 and Unit 1.

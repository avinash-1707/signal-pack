# Signal Pack Build Plan

**Companion docs:** [product overview](00-product-overview.md), [UI specification](01-ui-spec.md), [architecture](02-architecture.md), [research harness](03-research-harness.md), [API contracts](04-api-contracts.md), [data and retention](05-data-and-retention.md), [deployment](06-deployment.md), [coding standards](../coding-standards.md)

**Status:** Ready for execution
**Source of truth for:** build sequencing, ownership of implementation risk, and unit definitions of done. Actual completion belongs in [the progress tracker](../progress-tracker.md).

## How To Use This Plan

Work is grouped into independently reviewable units rather than time-boxed phases. A unit is complete only when its definition of done is met, including the required tests and security review. Do not begin a dependent unit by assuming an upstream integration works; use its documented fixture or contract until it is verified.

The product contract is already locked. A new requirement that changes product behavior, data retention, external side effects, or source-access policy must first update the owning spec and receive a dated entry in the progress tracker.

## Unit 0: Accounts And Local Prerequisites

**Retires the risk of:** a finished application that cannot be exercised against its required providers.

### Work

- Create development credentials for OpenAI, Brave Search, Neon, Google Sheets, and the selected Redis/KV provider.
- Create the service-account-owned Google Sheet and share it only with the service account.
- Prepare local Postgres, an environment template, and the Cartesia fixture path specified in [data and retention](05-data-and-retention.md).
- Configure a Vercel project and reserve environment variables without adding secrets to version control.

### Definition Of Done

- Startup environment validation reports every missing required value by name.
- The fixture test runs without provider credentials.
- Google Sheets credentials are limited to the one demonstration spreadsheet.

## Unit 1: Application Foundation

**Retires the risk of:** later features creating incompatible contracts, unsafe configuration, or unowned data.

### Work

- Scaffold a strict TypeScript Next.js App Router application with pnpm, linting, tests, and a documented development command.
- Add the shared Zod schemas for environment values, API contracts, domain records, and provider outcomes.
- Implement the authoritative Postgres schema and migrations from [data and retention](05-data-and-retention.md).
- Implement signed anonymous sessions, session-owned run access, immediate session deletion, and the Redis/KV rate-limit primitives.
- Add a structured logger that emits safe metadata only.

### Dependencies

Unit 0 for live integrations. Fixture-backed development can proceed without it.

### Definition Of Done

- A new browser session creates, reads, and deletes only its own run records.
- A cross-session run lookup returns `404`.
- Migration, lint, typecheck, and foundation tests pass.
- Security review confirms cookies, session ownership, and log handling do not leak secrets or run content.

## Unit 2: Evidence And Safe Retrieval Core

**Retires the risk of:** unsafe fetching or untraceable evidence invalidating every downstream brief.

### Work

- Implement URL normalization, public-address validation, redirect handling, response limits, robots enforcement, and bounded text extraction.
- Implement the Brave Search adapter, evidence normalization/deduplication, source-kind labeling, coverage calculation, and persisted tool traces.
- Implement provider retry classification and the `success`, `partial`, and `error` tool outcomes.
- Build the fixture-backed evidence path so core validators need no network access.

### Dependencies

Unit 1.

### Definition Of Done

- Private, credentialed, non-HTTPS, redirect-to-private, robots-denied, oversized, and unsupported-content targets make zero unsafe extraction requests.
- The Cartesia fixture yields eight normalized evidence records and expected coverage without external calls.
- Partial failures remain visible in the stored trace and report limitations.
- Security review confirms SSRF and robots controls are enforced at the fetch boundary, not only at input validation.

## Unit 3: Research And Brief Compilation

**Retires the risk of:** a plausible-looking but unsupported creator pack.

### Work

- Implement the bounded OpenAI Responses tool loop using the schemas and budgets in [research harness](03-research-harness.md).
- Persist only compact, sanitized evidence context for model compilation.
- Implement structured three-brief compilation and one repair pass for invalid model output.
- Implement citation, lane, normalized audience-lens, primary-evidence, required-field, and export-eligibility validation.

### Dependencies

Unit 2.

### Definition Of Done

- Fixture evidence produces exactly three valid briefs with distinct lanes, normalized audience lenses, and primary evidence IDs.
- An unknown citation or malformed model output cannot reach `awaiting_approval`.
- Missing usable first-party evidence finishes as `incomplete` and never produces an exportable pack.
- Security review confirms source text is treated as untrusted data and model output is schema-validated before persistence.

## Unit 4: Research Desk UI And Live Events

**Retires the risk of:** provenance and partial results being hidden behind an opaque AI interface.

### Work

- Build the intake, live trace, evidence ledger, source drawer, brief pack, and limitation states from [the UI specification](01-ui-spec.md).
- Implement the API client using [the API contracts](04-api-contracts.md) and resume-safe SSE event handling.
- Render the fixture report as a shareable static demo, separate from session-owned live runs.
- Implement responsive, keyboard-accessible, reduced-motion behavior.

### Dependencies

Units 1 through 3. The fixture path may be built before live provider credentials exist.

### Definition Of Done

- A reviewer can inspect an evidence citation, understand a partial source failure, and distinguish all three lanes without accessing model reasoning.
- The UI recovers from an SSE sequence gap by re-fetching the run.
- The complete fixture journey works at mobile and desktop widths.
- Accessibility checks cover keyboard source-drawer use, focus visibility, semantic labels, and reduced motion.

## Unit 5: Approval And Google Sheets Export

**Retires the risk of:** an unauthorised or duplicated external write.

### Work

- Implement the acknowledgment gate, approval record, presenter unlock flow, short-lived owner cookie, and export idempotency.
- Map approved briefs to the configured Google Sheets tracker rows.
- Surface export result and retryable failure without regenerating evidence or briefs.

### Dependencies

Units 1 and 3. Unit 4 is required for the complete user journey.

### Definition Of Done

- Approval cannot bypass citation or lane validation.
- A non-owner session cannot write to Sheets, even after approval.
- Replaying one idempotency key produces one tracker write.
- A provider failure preserves the approved pack for retry.
- Security review confirms timing-safe unlock comparison, owner-cookie binding, least-privilege Sheets access, and no unlock code in logs.

## Unit 6: Deployment, Hardening, And Demo

**Retires the risk of:** a locally convincing demo that fails in the deployed environment.

### Work

- Deploy the Next.js application, Neon database, rate-limit store, and Vercel Cron cleanup route.
- Add CI checks for formatting, linting, typechecking, tests, and migration validation.
- Exercise live research against a permitted public product and capture the required demo flow.
- Verify retention cleanup, rate limits, owner-only export, and production observability.

### Dependencies

Units 0 through 5.

### Definition Of Done

- The release checklist in [deployment](06-deployment.md) passes on the deployed environment.
- The static Cartesia fixture and one bounded live run both complete successfully.
- Expired sessions delete all dependent records.
- A final security review finds no unresolved high-severity issue.

## Dependency Summary

```text
Unit 0 (accounts) ────────┐
                          v
Unit 1 (foundation) -> Unit 2 (evidence) -> Unit 3 (compiler) -> Unit 4 (UI)
        |                       |                    |
        └───────────────────────┴────────────────────┴-> Unit 5 (approval/export)
                                                               |
                                                               v
                                                     Unit 6 (deploy/hardening)
```

## Completion Rules

- Mark a unit `Done` in the progress tracker only after its checks actually pass.
- Track provider-account or deployment blockers as external dependencies, not as completed work.
- Record any intentional deviation from a specification before relying on it in dependent work.

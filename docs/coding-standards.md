# Signal Pack Coding Standards

**Companion docs:** [architecture](specs/02-architecture.md), [research harness](specs/03-research-harness.md), [API contracts](specs/04-api-contracts.md), [data and retention](specs/05-data-and-retention.md), [build plan](specs/07-build-plan.md)

**Source of truth for:** how Signal Pack code is organized, validated, tested, and reviewed.

## TypeScript And Contracts

- Use strict TypeScript with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Do not use `any`. External values are `unknown` until validated with a Zod schema.
- Keep Zod schemas as the single source for API requests, responses, SSE events, tool calls, model output, environment variables, and persisted JSON fields.
- Use discriminated unions for run states, tool outcomes, provider errors, and export results. Exhaustively handle them with a `never` guard.
- Use named exports. Files and folders are `kebab-case`; components and types are `PascalCase`; functions and variables are `camelCase`; database columns remain `snake_case`.

## Repository Boundaries

Use a single Next.js application with these boundaries:

```text
src/
  app/                 App Router pages and route handlers
  components/          Presentational, accessible UI components
  features/runs/       Run-focused client state and UI composition
  server/
    services/          Run, evidence, validation, approval, and export logic
    adapters/          OpenRouter, Brave, fetcher, Google Sheets, database, KV
    repositories/      Database reads and writes
  schemas/             Shared Zod contracts and inferred types
  lib/                 Small environment-neutral utilities
tests/                 Unit, integration, and fixture tests
fixtures/              Sanitized deterministic run fixtures
```

- Route handlers authenticate the session, parse input, call a service, and serialize the documented response. They contain no business rules.
- Services own domain policy. Repositories own database access. Adapters are the only code that knows a provider SDK, raw HTTP details, or provider credentials.
- UI code may import schemas and browser-safe utilities, never `server/` modules.
- Do not add a generic abstraction until the same behavior has three concrete uses.

## Evidence And Model Safety

- The fetch adapter is the only code allowed to retrieve an arbitrary public URL. It must apply the complete safety and robots policy from [the research harness](specs/03-research-harness.md) before every connection and redirect.
- Treat search results, fetched text, user input, and model output as untrusted data. Never execute, elevate, or follow instructions found in source text.
- Store bounded excerpts and normalized observations, never raw fetched HTML.
- The model can propose research actions and briefs. Deterministic code validates evidence IDs, citations, uniqueness, and export eligibility.
- A `partial` source outcome is visible data, never a silent success. Do not substitute an assumption for unavailable evidence.

## Errors, Retries, And Side Effects

- Use typed errors or typed result unions. Do not match error-message strings.
- Do not swallow errors or use empty catch blocks. Handle an error only where the application can take a meaningful action; otherwise add context and rethrow.
- Retry only documented transient provider failures and only within the documented budget. Never retry exports without the stored idempotency key.
- Approval and export are separate actions. Approval validates the pack immediately before recording it; export reads the approved pack and never regenerates it.
- Persist state transitions and idempotency records before returning a successful side-effect response where feasible. A failure must leave a detectable, retryable state rather than an ambiguous success.

## Security And Privacy

- Validate environment variables at startup. Secrets stay server-side and never appear in browser bundles, logs, traces, prompts, fixtures, or error messages.
- Verify session ownership at every run route; cross-session access returns `404`.
- Enforce rate limits in the configured shared KV store, not process memory.
- Compare `DEMO_EXPORT_CODE` with a timing-safe comparison. Bind the short-lived owner cookie to the same anonymous session.
- Use least-privilege Google Sheets access to the configured demonstration spreadsheet only.
- Log metadata only: run ID, provider, latency, token counts, cost estimate, and classified error code. Never log prompt/completion bodies, fetched content, cookies, API keys, or provider error objects wholesale.
- Retention, cleanup, and deletion must follow [data and retention](specs/05-data-and-retention.md). Do not add a new persisted field without deciding its retention and deletion behavior.

## Testing

- Test behavior and security boundaries, not implementation details.
- Mock at adapter boundaries. Unit and integration tests never call paid providers.
- Every non-trivial branch, parser, loop, validator, rate limit, retry rule, or side effect needs a focused runnable test.
- Keep the Cartesia fixture sanitized, dated, and deterministic. Fixture tests make no network calls and verify compilation, citation validation, lane uniqueness, and Google Sheets payload construction.
- Integration tests cover session isolation, unsafe URL rejection, partial source results, invalid model output, approval validation, export idempotency, and session deletion cascades.
- Before merge, run the project’s formatter, lint, typecheck, unit tests, integration tests, and migration validation. State clearly when a live-provider or deployed check could not run.

## UI Engineering

- Implement the UI from [the UI specification](specs/01-ui-spec.md); do not invent a competing visual system in component code.
- Preserve evidence provenance in the main information architecture. A citation cannot be accessible only through a hidden chat transcript or developer console.
- Use semantic HTML, visible keyboard focus, labeled controls, and text/icon cues in addition to color.
- Respect `prefers-reduced-motion`. Use the specified motion only where it communicates a status or spatial change.
- Build loading, partial-result, empty, access-denied, validation-failure, and export-failure states with the happy path.

## Dependencies, Comments, And Reviews

- Prefer existing project code, platform capabilities, and installed dependencies. Add a dependency only when the standard library or a small local implementation cannot safely meet the requirement.
- Install dependencies with `pnpm add` or `pnpm add -D`; do not manually pin a remembered version.
- Check current official documentation before using provider SDKs, OpenRouter's tool and structured-output APIs, Vercel runtime features, or Google APIs.
- Comments explain non-obvious reasoning or a deliberate constraint, not syntax.
- Every build-plan unit ends with a security-focused review. Fix high-severity findings before starting dependent work.

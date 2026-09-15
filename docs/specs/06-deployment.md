# Signal Pack Deployment and Operations

## Fixed platform choices

| Concern | Choice |
|---|---|
| Web framework | Next.js 16 App Router |
| Hosting | Vercel |
| Database | Neon Postgres |
| Model access | OpenRouter Chat Completions API, `RESEARCH_MODEL` |
| Search | Brave Search API |
| Export | Google Sheets service account |
| Rate-limit store | Upstash Redis or Vercel KV |

## Topology

One Vercel deployment serves the UI, API routes, SSE endpoint, and protected daily purge route. Neon persists session-owned records. Redis/KV persists rate and active-run counters because Vercel function memory is not shared.

## Environment

```text
BRAVE_SEARCH_API_KEY
OPENROUTER_API_KEY
RESEARCH_MODEL
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_SHEET_ID
DATABASE_URL
KV_REST_API_URL
KV_REST_API_TOKEN
SESSION_SIGNING_SECRET
DEMO_EXPORT_CODE
CRON_SECRET
```

Validate all variables at startup. No secret may reach client JavaScript, logs, tool traces, or model context.

## Limits

| Scope | Limit |
|---|---:|
| Session | 3 runs per rolling 24 hours |
| IP | 5 runs per rolling 24 hours |
| Session | 1 active run |
| Global demo | 3 active runs |
| Run duration | 90 seconds |
| Search calls | 8/run |
| Extraction attempts | 8/run |
| Evidence records | 12/run |
| Export unlock attempts | 5/session/15 minutes |

Return `429` for scoped rate limits and `503 DEMO_AT_CAPACITY` for global capacity. Do not queue anonymous runs.

## Scheduled cleanup

Vercel Cron invokes `POST /api/internal/purge-expired` daily with a `CRON_SECRET`. The route deletes expired `sessions` in Postgres; foreign-key cascades delete all owned records. Cleanup uses an auditable count-only log and never logs source content.

## Release checklist

- Migration applied with cascading foreign keys verified.
- Fixture run passes without API credentials.
- Live run enforces robots policy and rate limits.
- Cross-session run reads return `404`.
- Export requires approval plus owner cookie.
- Vercel environment variables and Cron secret configured.

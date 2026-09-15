# Signal Pack Data, Ownership, and Retention

## Ownership model

Signal Pack is an anonymous, session-scoped demo. A signed session cookie maps to `sessions.id`. Every run has a mandatory `session_id`; authorization compares this stored value to the validated cookie session ID.

There are no accounts, email addresses, user profiles, or shared live run URLs in the MVP. The shareable demo is a static Cartesia fixture report.

## Authoritative schema

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE runs (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  objective TEXT NOT NULL CHECK (objective IN ('awareness', 'waitlist_signups', 'demo_requests')),
  audience TEXT NOT NULL,
  launch_date DATE,
  constraint_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'researching', 'validating', 'awaiting_approval', 'incomplete', 'complete', 'exported')),
  search_budget INTEGER NOT NULL,
  evidence_budget INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE tool_calls (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  arguments_json JSONB NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'partial', 'error')),
  latency_ms INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evidence (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  observations_json JSONB NOT NULL,
  roles_json JSONB NOT NULL,
  confidence TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  UNIQUE(run_id, content_hash)
);

CREATE TABLE creator_briefs (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  lane TEXT NOT NULL,
  brief_json JSONB NOT NULL
);

CREATE TABLE approvals (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  acknowledgment_version TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exports (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider = 'google_sheets'),
  provider_reference TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`ON DELETE CASCADE` is mandatory on every run-owned record. Deleting a session is the deletion primitive and cannot leave evidence or tool traces orphaned.

## Retention and deletion

- Session records expire 24 hours after creation.
- Run input, normalized evidence excerpts, tool metadata, briefs, approval, and export metadata are retained only through session expiry.
- Raw fetched HTML is used in memory only and discarded after the bounded evidence excerpt is persisted.
- A Vercel Cron job runs daily and executes one transaction: delete expired sessions; Postgres cascades all dependent records.
- `DELETE /api/session` uses the same session delete operation immediately.
- Failed cleanup is retried by the next scheduled invocation. The application does not silently extend retention because cleanup failed.
- Static fixture data is version-controlled test material, not user-run data.

## URL and consent policy

- Public product URLs may be submitted without proving ownership.
- A submitted URL authorizes only the requested, policy-permitted public-page lookup. It never authorizes a site crawl, authenticated access, or use of hidden APIs.
- Login-gated, customer-specific, dashboard, drive, or private-network URLs are rejected.
- User-uploaded media is not supported in the core MVP. Future uploads require an explicit authorization attestation and a separate retention policy.

## Acceptance fixture

`fixtures/cartesia-awareness-2026-09-15.json` is a fixed, sanitized test fixture.

```json
{
  "input": {
    "productUrl": "https://cartesia.ai/",
    "objective": "awareness",
    "audience": "AI engineers and technical founders",
    "launchDate": null,
    "constraint": "Do not make claims not present in first-party evidence."
  },
  "evidence": "8 normalized evidence records",
  "expected": {
    "briefCount": 3,
    "uniqueLanes": true,
    "uniquePrimaryEvidence": true,
    "citationValidation": "pass"
  }
}
```

Fixture test behavior: no network calls; compile the recorded evidence; validate the report; snapshot the Google Sheets payload. The fixture date must remain visible in the UI so it is never misrepresented as live research.

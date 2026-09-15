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

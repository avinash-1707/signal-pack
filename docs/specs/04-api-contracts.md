# Signal Pack API Contracts

## Contract rules

- Every request is scoped to the signed anonymous session cookie unless explicitly stated otherwise.
- Unknown fields fail validation.
- All IDs are UUIDs.
- API errors use `{ code, message, retryAfterSeconds? }` and never expose upstream provider bodies.
- A route that creates a side effect accepts an idempotency key and stores the first successful result.

## `POST /api/runs`

Creates a research run owned by the current session.

```ts
const CreateRunRequest = z.object({
  productUrl: z.string().url().max(2_048),
  objective: z.enum(["awareness", "waitlist_signups", "demo_requests"]),
  audience: z.string().min(3).max(200),
  launchDate: z.string().date().nullable(),
  constraint: z.string().max(500).nullable(),
}).strict();

const CreateRunResponse = z.object({
  runId: z.string().uuid(),
  status: z.literal("queued"),
});
```

The route creates the session when no valid session cookie exists. It enforces session/IP/global concurrency before storing the run.

## `GET /api/runs/:runId`

Returns a run only when `runs.session_id` matches the validated cookie's session ID. Any other case returns `404`, including an unknown run ID, to avoid exposing run existence.

```ts
const RunStatus = z.enum([
  "queued",
  "researching",
  "validating",
  "awaiting_approval",
  "incomplete",
  "complete",
  "exported",
]);

const EvidenceResponse = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  publisher: z.string(),
  sourceKind: z.enum(["first_party", "search_index", "third_party", "user_provided"]),
  excerpt: z.string(),
  roles: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  retrievedAt: z.string().datetime(),
});

const CreatorBriefResponse = z.object({
  id: z.string().uuid(),
  lane: z.enum(["engineer_proof", "founder_consequence", "practitioner_reaction"]),
  audienceLens: z.string(),
  primaryEvidenceId: z.string().uuid(),
  supportingEvidenceIds: z.array(z.string().uuid()),
  hook: z.string(),
  creatorPrompt: z.string(),
  requiredAsset: z.string(),
  cta: z.string(),
  prohibitedClaims: z.array(z.string()),
});

const GetRunResponse = z.object({
  id: z.string().uuid(),
  productUrl: z.string().url(),
  objective: z.enum(["awareness", "waitlist_signups", "demo_requests"]),
  audience: z.string(),
  launchDate: z.string().date().nullable(),
  constraint: z.string().nullable(),
  status: RunStatus,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  coverage: z.object({
    found: z.array(z.string()),
    notFoundInThisRun: z.array(z.string()),
  }).nullable(),
  evidence: z.array(EvidenceResponse),
  briefs: z.array(CreatorBriefResponse),
  approval: z.object({
    approvedAt: z.string().datetime(),
    acknowledgmentVersion: z.literal("creator-brief-review-v1"),
  }).nullable(),
  export: z.object({
    provider: z.literal("google_sheets"),
    exportedAt: z.string().datetime(),
  }).nullable(),
  limitations: z.array(z.string()),
});
```

## `GET /api/runs/:runId/events`

SSE endpoint for the owning session only. Events contain status transitions, safe tool-trace summaries, and evidence IDs. They never contain API keys, raw fetched HTML, model reasoning, or full model prompts.

Every SSE message is UTF-8 JSON in `data:` and validates against this discriminated union:

```ts
const RunSseEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run.status"),
    sequence: z.number().int().nonnegative(),
    status: RunStatus,
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal("tool.completed"),
    sequence: z.number().int().nonnegative(),
    tool: z.enum(["search_public_web", "extract_public_page", "finish_research"]),
    outcome: z.enum(["success", "partial", "error"]),
    summary: z.string().max(280),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal("evidence.added"),
    sequence: z.number().int().nonnegative(),
    evidence: EvidenceResponse,
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal("report.ready"),
    sequence: z.number().int().nonnegative(),
    runId: z.string().uuid(),
    status: z.enum(["awaiting_approval", "incomplete"]),
    at: z.string().datetime(),
  }),
  z.object({
    type: z.literal("run.error"),
    sequence: z.number().int().nonnegative(),
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    at: z.string().datetime(),
  }),
]);
```

`sequence` is monotonically increasing per run. The UI ignores duplicate or older events after an SSE reconnect and re-fetches `GET /api/runs/:runId` when it detects a sequence gap.

## `POST /api/runs/:runId/approve`

Records the human acknowledgment required before export. The run must belong to the calling session, be `awaiting_approval`, and pass citation and lane validators immediately before the approval is written.

```ts
const ApproveRunRequest = z.object({
  acknowledgmentVersion: z.literal("creator-brief-review-v1"),
  acknowledged: z.literal(true),
}).strict();

const ApproveRunResponse = z.object({
  approvalId: z.string().uuid(),
  status: z.literal("awaiting_approval"),
  approvedAt: z.string().datetime(),
  exportEligible: z.boolean(),
});
```

`exportEligible` is true only when the caller also holds the short-lived owner cookie. Approval itself is allowed for the owning anonymous session so the UI can demonstrate the gate without exposing Sheets writes.

## `POST /api/demo/unlock-export`

Exchanges the presenter's `DEMO_EXPORT_CODE` for a short-lived owner cookie. This route is demo-only. It does not create an account or persistent identity.

```ts
const UnlockExportRequest = z.object({
  code: z.string().min(1).max(128),
}).strict();

const UnlockExportResponse = z.object({
  unlockedUntil: z.string().datetime(),
});
```

Implementation requirements:

- Compare the submitted code with `DEMO_EXPORT_CODE` using a timing-safe comparison.
- Limit to five attempts per session per 15 minutes; return `429 EXPORT_UNLOCK_LIMIT_REACHED` after the limit.
- On success, set a separate signed, httpOnly, `Secure`, `SameSite=Strict` owner cookie with a 15-minute expiry.
- The owner cookie contains only the session ID, an owner capability value, expiry, and signature.
- Do not log request bodies or failed codes.

## `POST /api/runs/:runId/export`

Writes approved briefs to the configured Google Sheet. Requires the run's owning session, a valid approval record, a valid owner cookie bound to the same session, and an idempotency key.

```ts
const ExportRunRequest = z.object({
  idempotencyKey: z.string().uuid(),
}).strict();

const ExportRunResponse = z.object({
  exportId: z.string().uuid(),
  spreadsheetId: z.string(),
  range: z.string(),
  exportedAt: z.string().datetime(),
});
```

Known-not-written Google failures remain retryable; an ambiguous timeout, `429`, or `5xx` retains its idempotency reservation so a retry cannot duplicate a tracker row. The route never regenerates research, rewrites briefs, or reuses an idempotency key for a different run.

The configured tracker receives one `RAW` row per approved brief, in this order: run ID, brief ID, lane, audience lens, hook, creator prompt, required asset, CTA, prohibited claims, primary evidence ID, and supporting evidence IDs. These IDs make a provider outcome auditable without sending raw source content to Google Sheets.

## `DELETE /api/session`

Immediately deletes the current session and cascades to its runs, tool calls, evidence, briefs, approvals, and export records. It clears both session and owner cookies even if the session has already expired.

```ts
const DeleteSessionResponse = z.object({ deleted: z.literal(true) });
```

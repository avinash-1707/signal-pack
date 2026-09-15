import { z } from "zod";

import {
  apiErrorSchema,
  approveRunRequestSchema,
  approveRunResponseSchema,
  createRunRequestSchema,
  createRunResponseSchema,
  exportRunRequestSchema,
  exportRunResponseSchema,
  getRunResponseSchema,
  runSseEventSchema,
  unlockExportRequestSchema,
  unlockExportResponseSchema,
} from "@/schemas/api";

export type CreateRunInput = z.infer<typeof createRunRequestSchema>;
export type RunReport = z.infer<typeof getRunResponseSchema>;
export type RunEvidence = RunReport["evidence"][number];
export type RunBrief = RunReport["briefs"][number];
export type RunEvent = z.infer<typeof runSseEventSchema>;

export class RunApiError extends Error {
  readonly retryAfterSeconds: number | undefined;

  constructor(readonly code: string, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "RunApiError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RunApiError("INVALID_RESPONSE", "The research desk received an invalid response.");
  }
}

function throwApiError(body: unknown): never {
  const error = apiErrorSchema.safeParse(body);
  if (error.success) {
    throw new RunApiError(error.data.code, error.data.message, error.data.retryAfterSeconds);
  }
  throw new RunApiError("REQUEST_FAILED", "The research desk could not complete that request.");
}

export async function createRun(input: CreateRunInput): Promise<z.infer<typeof createRunResponseSchema>> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createRunRequestSchema.parse(input)),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throwApiError(body);
  }
  return createRunResponseSchema.parse(body);
}

export async function getRun(runId: string): Promise<RunReport> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
  const body = await parseResponse(response);
  if (!response.ok) {
    throwApiError(body);
  }
  return getRunResponseSchema.parse(body);
}

export async function approveRun(runId: string): Promise<z.infer<typeof approveRunResponseSchema>> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(approveRunRequestSchema.parse({
      acknowledgmentVersion: "creator-brief-review-v1",
      acknowledged: true,
    })),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throwApiError(body);
  }
  return approveRunResponseSchema.parse(body);
}

export async function unlockExport(code: string): Promise<z.infer<typeof unlockExportResponseSchema>> {
  const response = await fetch("/api/demo/unlock-export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(unlockExportRequestSchema.parse({ code })),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throwApiError(body);
  }
  return unlockExportResponseSchema.parse(body);
}

export async function exportRun(
  runId: string,
  idempotencyKey: string,
): Promise<z.infer<typeof exportRunResponseSchema>> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/export`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(exportRunRequestSchema.parse({ idempotencyKey })),
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throwApiError(body);
  }
  return exportRunResponseSchema.parse(body);
}

type RunEventConnectionOptions = {
  lastSequence?: number;
  onEvent: (event: RunEvent) => void;
  onSequenceGap: () => void;
};

/**
 * EventSource reconnects automatically. Sequence handling makes each reconnect
 * idempotent and asks the caller to refresh authoritative state when events were missed.
 */
export function connectRunEvents(runId: string, options: RunEventConnectionOptions): () => void {
  let lastSequence = options.lastSequence ?? -1;
  const stream = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);

  stream.onmessage = (message) => {
    let payload: unknown;
    try {
      payload = JSON.parse(message.data) as unknown;
    } catch {
      return;
    }

    const event = runSseEventSchema.safeParse(payload);
    if (!event.success || event.data.sequence <= lastSequence) {
      return;
    }
    if (event.data.sequence > lastSequence + 1) {
      lastSequence = event.data.sequence;
      options.onSequenceGap();
      return;
    }

    lastSequence = event.data.sequence;
    if (event.data.type === "report.ready") {
      stream.close();
    }
    options.onEvent(event.data);
  };

  return () => stream.close();
}

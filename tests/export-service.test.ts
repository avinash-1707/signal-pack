import { describe, expect, it } from "vitest";

import { buildTrackerRows, GoogleSheetsProviderError } from "../src/server/adapters/google-sheets";
import type { ApprovalCandidate } from "../src/server/repositories/approval-repository";
import { ExportService } from "../src/server/services/export-service";

const runId = "6c4c1e99-7272-4d07-8382-dca1649112a9";
const sessionId = "d41dbad0-2f91-4f07-b8e9-73d7f90c08f7";
const key = "ab9ae5e9-d80e-49d4-9ae7-4730b5c1ca6c";

const candidate: ApprovalCandidate = {
  evidence: [],
  briefs: [{
    id: "58a75de6-9ca4-47f5-a8fc-0cf9be2140e7",
    runId,
    lane: "engineer_proof",
    audienceLens: "AI engineers",
    primaryEvidenceId: "bd5071a8-0c9f-455e-bf5f-d80c97e7e0c0",
    supportingEvidenceIds: [],
    hook: "Inspect the source.",
    creatorPrompt: "Walk through the source.",
    requiredAsset: "Product documentation",
    cta: "Read the evidence",
    prohibitedClaims: ["Do not invent results."],
  }],
};

describe("ExportService", () => {
  it("releases a failed export reservation while preserving the approved pack", async () => {
    let released: string | undefined;
    const service = new ExportService({
      async findExport() { return null; },
      async loadApprovedCandidate() { return candidate; },
      async reserveExport() { return true; },
      async completeExport() { return null; },
      async releaseReservation(exportId) { released = exportId; },
    }, {
      async appendTrackerRows() { throw new GoogleSheetsProviderError(true); },
    });

    await expect(service.export(runId, sessionId, key)).resolves.toEqual({ kind: "provider_failure" });
    expect(released).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps an ambiguous export reservation so retries cannot duplicate a write", async () => {
    let released = false;
    const service = new ExportService({
      async findExport() { return null; },
      async loadApprovedCandidate() { return candidate; },
      async reserveExport() { return true; },
      async completeExport() { return null; },
      async releaseReservation() { released = true; },
    }, {
      async appendTrackerRows() { throw new GoogleSheetsProviderError(false); },
    });

    await expect(service.export(runId, sessionId, key)).resolves.toEqual({ kind: "in_progress" });
    expect(released).toBe(false);
  });

  it("replays a completed idempotency key without writing again", async () => {
    let writes = 0;
    const service = new ExportService({
      async findExport() {
        return {
          id: "c5e514b8-3ec5-40a1-a24d-5e3ac93b4a8f",
          runId,
          providerReference: JSON.stringify({ spreadsheetId: "sheet-1", range: "A2:K4" }),
          exportedAt: new Date("2026-09-15T12:00:00.000Z"),
        };
      },
      async loadApprovedCandidate() { return null; },
      async reserveExport() { return false; },
      async completeExport() { return null; },
      async releaseReservation() {},
    }, {
      async appendTrackerRows() { writes += 1; return { spreadsheetId: "sheet-1", range: "A2:K4" }; },
    });

    await expect(service.export(runId, sessionId, key)).resolves.toMatchObject({ kind: "exported", range: "A2:K4" });
    expect(writes).toBe(0);
  });
});

describe("Google Sheets payload", () => {
  it("maps approved brief fields into one deterministic tracker row", () => {
    expect(buildTrackerRows(runId, candidate.briefs)).toEqual([[
      runId,
      "58a75de6-9ca4-47f5-a8fc-0cf9be2140e7",
      "engineer_proof",
      "AI engineers",
      "Inspect the source.",
      "Walk through the source.",
      "Product documentation",
      "Read the evidence",
      "Do not invent results.",
      "bd5071a8-0c9f-455e-bf5f-d80c97e7e0c0",
      "",
    ]]);
  });
});

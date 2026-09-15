import { randomUUID } from "node:crypto";

import { GoogleSheetsProviderError, type GoogleSheetsAdapter } from "@/server/adapters/google-sheets";
import type { ApprovalRepository, ExportRecord } from "@/server/repositories/approval-repository";

export type ExportResult =
  | { kind: "exported"; exportId: string; spreadsheetId: string; range: string; exportedAt: Date }
  | { kind: "not_found" }
  | { kind: "key_reused" }
  | { kind: "in_progress" }
  | { kind: "provider_failure" };

function fromRecord(record: ExportRecord): ExportResult {
  if (record.providerReference === "pending") {
    return { kind: "in_progress" };
  }
  try {
    const parsed = JSON.parse(record.providerReference) as unknown;
    if (
      parsed && typeof parsed === "object" && "spreadsheetId" in parsed && "range" in parsed &&
      typeof parsed.spreadsheetId === "string" && typeof parsed.range === "string"
    ) {
      return { kind: "exported", exportId: record.id, spreadsheetId: parsed.spreadsheetId, range: parsed.range, exportedAt: record.exportedAt };
    }
  } catch {
    return { kind: "provider_failure" };
  }
  return { kind: "provider_failure" };
}

export class ExportService {
  constructor(
    private readonly exports: Pick<ApprovalRepository, "loadApprovedCandidate" | "findExport" | "reserveExport" | "completeExport" | "releaseReservation">,
    private readonly sheets: Pick<GoogleSheetsAdapter, "appendTrackerRows">,
  ) {}

  async export(runId: string, sessionId: string, idempotencyKey: string): Promise<ExportResult> {
    const prior = await this.exports.findExport(idempotencyKey);
    if (prior) {
      return prior.runId === runId ? fromRecord(prior) : { kind: "key_reused" };
    }
    const candidate = await this.exports.loadApprovedCandidate(runId, sessionId);
    if (!candidate) {
      return { kind: "not_found" };
    }
    const exportId = randomUUID();
    if (!await this.exports.reserveExport(runId, sessionId, idempotencyKey, exportId)) {
      const concurrent = await this.exports.findExport(idempotencyKey);
      return concurrent && concurrent.runId === runId ? fromRecord(concurrent) : { kind: "key_reused" };
    }

    try {
      const result = await this.sheets.appendTrackerRows(runId, candidate.briefs);
      const exportedAt = await this.exports.completeExport(exportId, JSON.stringify(result));
      return exportedAt
        ? { kind: "exported", exportId, ...result, exportedAt }
        : { kind: "provider_failure" };
    } catch (error: unknown) {
      if (error instanceof GoogleSheetsProviderError && error.knownNotWritten) {
        await this.exports.releaseReservation(exportId);
        return { kind: "provider_failure" };
      }
      return { kind: "in_progress" };
    }
  }
}

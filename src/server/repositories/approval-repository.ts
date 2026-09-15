import { creatorBriefSchema, type CreatorBrief } from "@/schemas/brief";
import type { Evidence } from "@/schemas/evidence";
import type { Database } from "@/server/adapters/database";

export type ApprovalRecord = {
  id: string;
  approvedAt: Date;
  acknowledgmentVersion: "creator-brief-review-v1";
};

export type ApprovalCandidate = {
  briefs: CreatorBrief[];
  evidence: Evidence[];
};

export type ExportRecord = {
  id: string;
  runId: string;
  providerReference: string;
  exportedAt: Date;
};

type ApprovalRow = {
  id: string;
  approved_at: Date;
  acknowledgment_version: "creator-brief-review-v1";
};

type EvidenceRow = {
  id: string;
  run_id: string;
  url: string;
  title: string;
  publisher: string;
  source_kind: Evidence["sourceKind"];
  excerpt: string;
  observations_json: string[];
  roles_json: Evidence["roles"];
  confidence: Evidence["confidence"];
  content_hash: string;
  retrieved_at: Date;
};

type BriefRow = { brief_json: unknown };

type ExportRow = {
  id: string;
  run_id: string;
  provider_reference: string;
  exported_at: Date;
};

export class ApprovalRepository {
  constructor(private readonly database: Database) {}

  async loadCandidate(runId: string, sessionId: string): Promise<ApprovalCandidate | null> {
    const run = await this.database.query<{ id: string }>(
      "SELECT id FROM runs WHERE id = $1 AND session_id = $2 AND status = 'awaiting_approval'",
      [runId, sessionId],
    );
    if (run.rowCount !== 1) {
      return null;
    }

    const [evidenceResult, briefsResult] = await Promise.all([
      this.database.query<EvidenceRow>(
        `SELECT id, run_id, url, title, publisher, source_kind, excerpt, observations_json,
          roles_json, confidence, content_hash, retrieved_at FROM evidence WHERE run_id = $1`,
        [runId],
      ),
      this.database.query<BriefRow>("SELECT brief_json FROM creator_briefs WHERE run_id = $1", [runId]),
    ]);
    const briefs: CreatorBrief[] = [];
    for (const row of briefsResult.rows) {
      const brief = creatorBriefSchema.safeParse(row.brief_json);
      if (!brief.success) {
        return null;
      }
      briefs.push(brief.data);
    }

    return {
      evidence: evidenceResult.rows.map((row) => ({
        id: row.id,
        runId: row.run_id,
        url: row.url,
        title: row.title,
        publisher: row.publisher,
        sourceKind: row.source_kind,
        excerpt: row.excerpt,
        observations: row.observations_json,
        roles: row.roles_json,
        confidence: row.confidence,
        contentHash: row.content_hash,
        retrievedAt: row.retrieved_at.toISOString(),
      })),
      briefs,
    };
  }

  async create(runId: string, sessionId: string, approvalId: string): Promise<ApprovalRecord | null> {
    const result = await this.database.query<ApprovalRow>(
      `INSERT INTO approvals (id, run_id, session_id, acknowledgment_version)
       SELECT $3, runs.id, runs.session_id, 'creator-brief-review-v1'
       FROM runs
       WHERE runs.id = $1 AND runs.session_id = $2 AND runs.status = 'awaiting_approval'
       ON CONFLICT (run_id) DO NOTHING
       RETURNING id, approved_at, acknowledgment_version`,
      [runId, sessionId, approvalId],
    );
    const approval = result.rows[0];
    return approval
      ? { id: approval.id, approvedAt: approval.approved_at, acknowledgmentVersion: approval.acknowledgment_version }
      : null;
  }

  async loadApprovedCandidate(runId: string, sessionId: string): Promise<ApprovalCandidate | null> {
    const approval = await this.database.query<{ id: string }>(
      `SELECT approvals.id FROM approvals
       JOIN runs ON runs.id = approvals.run_id
       WHERE approvals.run_id = $1 AND approvals.session_id = $2
         AND runs.session_id = $2 AND runs.status = 'awaiting_approval'`,
      [runId, sessionId],
    );
    return approval.rowCount === 1 ? this.loadCandidate(runId, sessionId) : null;
  }

  async findExport(idempotencyKey: string): Promise<ExportRecord | null> {
    const result = await this.database.query<ExportRow>(
      "SELECT id, run_id, provider_reference, exported_at FROM exports WHERE idempotency_key = $1",
      [idempotencyKey],
    );
    const record = result.rows[0];
    return record
      ? { id: record.id, runId: record.run_id, providerReference: record.provider_reference, exportedAt: record.exported_at }
      : null;
  }

  async reserveExport(runId: string, sessionId: string, idempotencyKey: string, exportId: string): Promise<boolean> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO exports (id, run_id, idempotency_key, provider, provider_reference)
       SELECT $4, runs.id, $3, 'google_sheets', 'pending'
       FROM runs
       JOIN approvals ON approvals.run_id = runs.id
       WHERE runs.id = $1 AND runs.session_id = $2 AND approvals.session_id = $2
         AND runs.status = 'awaiting_approval'
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [runId, sessionId, idempotencyKey, exportId],
    );
    return result.rowCount === 1;
  }

  async completeExport(exportId: string, providerReference: string): Promise<Date | null> {
    const result = await this.database.query<ExportRow>(
      `WITH completed AS (
         UPDATE exports SET provider_reference = $2 WHERE id = $1 AND provider_reference = 'pending'
         RETURNING run_id, exported_at
       ), transitioned AS (
         UPDATE runs SET status = 'exported' WHERE id = (SELECT run_id FROM completed)
         RETURNING id
       )
       SELECT $1::uuid AS id, completed.run_id, $2 AS provider_reference, completed.exported_at FROM completed`,
      [exportId, providerReference],
    );
    return result.rows[0]?.exported_at ?? null;
  }

  async releaseReservation(exportId: string): Promise<void> {
    await this.database.query("DELETE FROM exports WHERE id = $1 AND provider_reference = 'pending'", [exportId]);
  }
}

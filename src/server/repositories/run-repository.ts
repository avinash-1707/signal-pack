import type { CreateRunRequest } from "@/schemas/api";
import type { RunStatus } from "@/schemas/domain";
import type { Database } from "@/server/adapters/database";

export type RunRecord = CreateRunRequest & {
  id: string;
  status: RunStatus;
  createdAt: Date;
  completedAt: Date | null;
  approval: { approvedAt: Date; acknowledgmentVersion: "creator-brief-review-v1" } | null;
  export: { provider: "google_sheets"; exportedAt: Date } | null;
};

type RunRow = {
  id: string;
  product_url: string;
  objective: CreateRunRequest["objective"];
  audience: string;
  launch_date: string | null;
  constraint_text: string | null;
  status: RunStatus;
  created_at: Date;
  completed_at: Date | null;
  approved_at: Date | null;
  acknowledgment_version: "creator-brief-review-v1" | null;
  provider: "google_sheets" | null;
  exported_at: Date | null;
};

export class RunRepository {
  constructor(private readonly database: Database) {}

  async create(id: string, sessionId: string, input: CreateRunRequest): Promise<void> {
    await this.database.query(
      `INSERT INTO runs (
        id, session_id, product_url, objective, audience, launch_date, constraint_text,
        status, search_budget, evidence_budget
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', 8, 12)`,
      [
        id,
        sessionId,
        input.productUrl,
        input.objective,
        input.audience,
        input.launchDate,
        input.constraint,
      ],
    );
  }

  async findOwned(id: string, sessionId: string): Promise<RunRecord | null> {
    const result = await this.database.query<RunRow>(
      `SELECT runs.id, product_url, objective, audience, launch_date, constraint_text, status,
         created_at, completed_at, approvals.approved_at, approvals.acknowledgment_version,
         exports.provider, exports.exported_at
       FROM runs
       LEFT JOIN approvals ON approvals.run_id = runs.id
       LEFT JOIN exports ON exports.run_id = runs.id AND exports.provider_reference <> 'pending'
       WHERE runs.id = $1 AND runs.session_id = $2`,
      [id, sessionId],
    );
    const run = result.rows[0];
    if (!run) {
      return null;
    }

    return {
      id: run.id,
      productUrl: run.product_url,
      objective: run.objective,
      audience: run.audience,
      launchDate: run.launch_date,
      constraint: run.constraint_text,
      status: run.status,
      createdAt: run.created_at,
      completedAt: run.completed_at,
      approval: run.approved_at && run.acknowledgment_version
        ? { approvedAt: run.approved_at, acknowledgmentVersion: run.acknowledgment_version }
        : null,
      export: run.provider && run.exported_at ? { provider: run.provider, exportedAt: run.exported_at } : null,
    };
  }

  async findActiveBySession(sessionId: string): Promise<RunRecord | null> {
    const result = await this.database.query<RunRow>(
      `SELECT runs.id, product_url, objective, audience, launch_date, constraint_text, status,
         created_at, completed_at, approvals.approved_at, approvals.acknowledgment_version,
         exports.provider, exports.exported_at
       FROM runs
       LEFT JOIN approvals ON approvals.run_id = runs.id
       LEFT JOIN exports ON exports.run_id = runs.id AND exports.provider_reference <> 'pending'
       WHERE session_id = $1
         AND status IN ('queued', 'researching', 'validating')
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId],
    );
    const run = result.rows[0];
    if (!run) {
      return null;
    }

    return {
      id: run.id,
      productUrl: run.product_url,
      objective: run.objective,
      audience: run.audience,
      launchDate: run.launch_date,
      constraint: run.constraint_text,
      status: run.status,
      createdAt: run.created_at,
      completedAt: run.completed_at,
      approval: run.approved_at && run.acknowledgment_version
        ? { approvedAt: run.approved_at, acknowledgmentVersion: run.acknowledgment_version }
        : null,
      export: run.provider && run.exported_at ? { provider: run.provider, exportedAt: run.exported_at } : null,
    };
  }

  async markIncomplete(id: string): Promise<void> {
    await this.database.query(
      `UPDATE runs SET status = 'incomplete', completed_at = now()
       WHERE id = $1 AND status = 'validating'`,
      [id],
    );
  }

}

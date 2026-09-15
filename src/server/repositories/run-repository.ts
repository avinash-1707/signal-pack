import type { CreateRunRequest } from "@/schemas/api";
import type { RunStatus } from "@/schemas/domain";
import type { Database } from "@/server/adapters/database";

export type RunRecord = CreateRunRequest & {
  id: string;
  status: RunStatus;
  createdAt: Date;
  completedAt: Date | null;
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
      `SELECT id, product_url, objective, audience, launch_date, constraint_text, status,
        created_at, completed_at
       FROM runs WHERE id = $1 AND session_id = $2`,
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
    };
  }

  async findActiveBySession(sessionId: string): Promise<RunRecord | null> {
    const result = await this.database.query<RunRow>(
      `SELECT id, product_url, objective, audience, launch_date, constraint_text, status,
        created_at, completed_at
       FROM runs
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
    };
  }

  async setStatus(id: string, status: RunStatus): Promise<void> {
    await this.database.query(
      `UPDATE runs
       SET status = $2,
           completed_at = CASE WHEN $2 IN ('awaiting_approval', 'incomplete') THEN now() ELSE completed_at END
       WHERE id = $1`,
      [id, status],
    );
  }
}

import type { CreatorBrief } from "../../schemas/brief";
import type { Database } from "../adapters/database";

export class BriefRepository {
  constructor(private readonly database: Database) {}

  async saveAndAwaitApproval(briefs: readonly CreatorBrief[]): Promise<boolean> {
    if (briefs.length !== 3) {
      throw new Error("Only validated three-brief packs can be persisted");
    }
    const values = briefs.flatMap((brief) => [brief.id, brief.runId, brief.lane, JSON.stringify(brief)]);
    const result = await this.database.query<{ id: string }>(
      `WITH transitioned AS (
         UPDATE runs
         SET status = 'awaiting_approval', completed_at = now()
         WHERE id = $2 AND status = 'validating'
         RETURNING id
       ), inserted AS (
         INSERT INTO creator_briefs (id, run_id, lane, brief_json)
         SELECT $1, transitioned.id, $3, $4 FROM transitioned
         UNION ALL SELECT $5, transitioned.id, $7, $8 FROM transitioned
         UNION ALL SELECT $9, transitioned.id, $11, $12 FROM transitioned
         RETURNING id
       ) SELECT id FROM inserted`,
      values,
    );
    return result.rowCount === 3;
  }
}

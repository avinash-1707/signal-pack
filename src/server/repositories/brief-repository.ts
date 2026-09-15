import type { CreatorBrief } from "@/schemas/brief";
import type { Database } from "@/server/adapters/database";

export class BriefRepository {
  constructor(private readonly database: Database) {}

  async saveAll(briefs: readonly CreatorBrief[]): Promise<void> {
    if (briefs.length !== 3) {
      throw new Error("Only validated three-brief packs can be persisted");
    }
    const values = briefs.flatMap((brief) => [brief.id, brief.runId, brief.lane, JSON.stringify(brief)]);
    await this.database.query(
      `INSERT INTO creator_briefs (id, run_id, lane, brief_json)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)`,
      values,
    );
  }
}

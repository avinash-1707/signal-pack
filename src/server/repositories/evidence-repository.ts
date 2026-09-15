import type { Evidence, ToolTrace } from "@/schemas/evidence";
import type { Database } from "@/server/adapters/database";

export class EvidenceRepository {
  constructor(private readonly database: Database) {}

  async save(evidence: Evidence): Promise<boolean> {
    const result = await this.database.query(
      `INSERT INTO evidence (
        id, run_id, url, title, publisher, source_kind, excerpt, observations_json,
        roles_json, confidence, content_hash, retrieved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (run_id, content_hash) DO NOTHING`,
      [
        evidence.id, evidence.runId, evidence.url, evidence.title, evidence.publisher,
        evidence.sourceKind, evidence.excerpt, JSON.stringify(evidence.observations),
        JSON.stringify(evidence.roles), evidence.confidence, evidence.contentHash, evidence.retrievedAt,
      ],
    );
    return result.rowCount === 1;
  }

  async saveTrace(trace: ToolTrace): Promise<void> {
    await this.database.query(
      `INSERT INTO tool_calls (
        id, run_id, sequence, tool_name, arguments_json, outcome, latency_ms, error_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        trace.id, trace.runId, trace.sequence, trace.toolName, JSON.stringify(trace.arguments),
        trace.outcome, trace.latencyMs, trace.errorCode,
      ],
    );
  }
}

import type { Evidence } from "@/schemas/evidence";
import type { OpenRouter } from "@/server/adapters/open-router";
import type { BriefRepository } from "@/server/repositories/brief-repository";
import type { RunRepository } from "@/server/repositories/run-repository";
import { compileBriefs, type BriefCompilation } from "./brief-compilation-service";

export async function compileAndPersistReport(
  client: Pick<OpenRouter, "complete">,
  briefs: BriefRepository,
  runs: Pick<RunRepository, "setStatus">,
  runId: string,
  evidence: readonly Evidence[],
): Promise<BriefCompilation> {
  const report = await compileBriefs(client, runId, evidence);
  if (report.status === "incomplete") {
    await runs.setStatus(runId, "incomplete");
    return report;
  }

  await briefs.saveAll(report.briefs);
  await runs.setStatus(runId, "awaiting_approval");
  return report;
}

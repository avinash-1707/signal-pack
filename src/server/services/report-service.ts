import type { Evidence } from "../../schemas/evidence";
import type { OpenRouter } from "../adapters/open-router";
import type { BriefRepository } from "../repositories/brief-repository";
import type { RunRepository } from "../repositories/run-repository";
import { compileBriefs, type BriefCompilation } from "./brief-compilation-service";

export async function compileAndPersistReport(
  client: Pick<OpenRouter, "complete">,
  briefs: Pick<BriefRepository, "saveAndAwaitApproval">,
  runs: Pick<RunRepository, "markIncomplete">,
  runId: string,
  evidence: readonly Evidence[],
): Promise<BriefCompilation> {
  const report = await compileBriefs(client, runId, evidence);
  if (report.status === "incomplete") {
    await runs.markIncomplete(runId);
    return report;
  }

  if (await briefs.saveAndAwaitApproval(report.briefs)) {
    return report;
  }
  await runs.markIncomplete(runId);
  return { status: "incomplete", limitations: ["The run could not transition to an approval-ready report."] };
}

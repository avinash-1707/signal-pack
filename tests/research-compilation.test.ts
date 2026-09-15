import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { Evidence } from "../src/schemas/evidence";
import type { OpenRouter, OpenRouterCompletion, OpenRouterToolCall } from "../src/server/adapters/open-router";
import { compileBriefs } from "../src/server/services/brief-compilation-service";
import { collectResearchEvidence } from "../src/server/services/research-harness-service";
import { compileAndPersistReport } from "../src/server/services/report-service";
import { normalizeEvidence } from "../src/server/services/evidence-service";

const runId = "6c4c1e99-7272-4d07-8382-dca1649112a9";

async function fixtureEvidence(): Promise<Evidence[]> {
  const fixture: { input: { productUrl: string }; evidence: Array<Omit<Parameters<typeof normalizeEvidence>[0], "runId" | "retrievedAt">> } = JSON.parse(
    await readFile(resolve(process.cwd(), "fixtures/cartesia-awareness-2026-09-15.json"), "utf8"),
  );
  return fixture.evidence.map((item) => normalizeEvidence({
    ...item,
    runId,
    retrievedAt: "2026-09-15T12:00:00.000Z",
  }, fixture.input.productUrl));
}

function proposal(evidence: readonly Evidence[], unknownCitation = false): string {
  const primary = unknownCitation ? "6ff1e733-cb60-4c47-abaf-3b5b8c019d28" : evidence[0]!.id;
  return JSON.stringify({
    briefs: [
      { lane: "engineer_proof", audienceLens: "AI engineers", primaryEvidenceId: primary, supportingEvidenceIds: [evidence[1]!.id], hook: "Inspect the recorded product evidence.", creatorPrompt: "Walk through the documented technical context.", requiredAsset: "Product documentation", cta: "Review the evidence ledger", prohibitedClaims: ["Do not claim benchmark results."] },
      { lane: "founder_consequence", audienceLens: "Technical founders", primaryEvidenceId: evidence[2]!.id, supportingEvidenceIds: [evidence[3]!.id], hook: "Frame the recorded launch context.", creatorPrompt: "Explain the documented launch trade-off.", requiredAsset: "Launch context", cta: "Inspect the cited sources", prohibitedClaims: ["Do not claim customer outcomes."] },
      { lane: "practitioner_reaction", audienceLens: "Product practitioners", primaryEvidenceId: evidence[4]!.id, supportingEvidenceIds: [evidence[5]!.id], hook: "React to the recorded product context.", creatorPrompt: "Show how a practitioner can inspect the source material.", requiredAsset: "Product page", cta: "Read the source evidence", prohibitedClaims: ["Do not claim availability."] },
    ],
  });
}

function client(responses: string[]): Pick<OpenRouter, "complete"> {
  let index = 0;
  return {
    async complete(): Promise<OpenRouterCompletion> {
      const content = responses[index++];
      return { content: content ?? null, toolCalls: [] };
    },
  };
}

describe("brief compilation", () => {
  it("compiles the fixture into exactly three valid, differentiated briefs", async () => {
    const evidence = await fixtureEvidence();
    const result = await compileBriefs(client([proposal(evidence)]), runId, evidence);

    expect(result.status).toBe("awaiting_approval");
    if (result.status === "awaiting_approval") {
      expect(result.briefs).toHaveLength(3);
      expect(new Set(result.briefs.map((brief) => brief.lane))).toHaveLength(3);
      expect(new Set(result.briefs.map((brief) => brief.primaryEvidenceId))).toHaveLength(3);
    }
  });

  it("allows one repair pass but does not persist an unknown citation", async () => {
    const evidence = await fixtureEvidence();
    const result = await compileBriefs(client([proposal(evidence, true), proposal(evidence, true)]), runId, evidence);

    expect(result).toEqual({
      status: "incomplete",
      limitations: ["The brief proposal could not be validated against this run's evidence."],
    });
  });

  it("rejects duplicate lanes, audience lenses, and primary evidence IDs", async () => {
    const evidence = await fixtureEvidence();
    const duplicated = JSON.parse(proposal(evidence)) as { briefs: Array<Record<string, unknown>> };
    duplicated.briefs[1] = {
      ...duplicated.briefs[1],
      lane: "engineer_proof",
      audienceLens: " AI   engineers ",
      primaryEvidenceId: evidence[0]!.id,
    };

    const result = await compileBriefs(client([JSON.stringify(duplicated), JSON.stringify(duplicated)]), runId, evidence);

    expect(result.status).toBe("incomplete");
  });

  it("repairs malformed model output once before returning an exportable pack", async () => {
    const evidence = await fixtureEvidence();
    const result = await compileBriefs(client(["not JSON", proposal(evidence)]), runId, evidence);

    expect(result.status).toBe("awaiting_approval");
  });

  it("marks the run incomplete without calling the model when first-party evidence is absent", async () => {
    const evidence = (await fixtureEvidence()).map((item) => ({ ...item, sourceKind: "third_party" as const }));
    let calls = 0;
    const result = await compileBriefs({
      async complete() {
        calls += 1;
        return { content: proposal(evidence), toolCalls: [] };
      },
    }, runId, evidence);

    expect(result.status).toBe("incomplete");
    expect(calls).toBe(0);
  });

  it("persists briefs before exposing awaiting approval", async () => {
    const evidence = await fixtureEvidence();
    const events: string[] = [];
    const result = await compileAndPersistReport(
      client([proposal(evidence)]),
      { async saveAndAwaitApproval() { events.push("briefs"); return true; } },
      { async markIncomplete() { events.push("incomplete"); } },
      runId,
      evidence,
    );

    expect(result.status).toBe("awaiting_approval");
    expect(events).toEqual(["briefs"]);
  });
});

describe("research harness", () => {
  it("records invalid tool arguments without calling a tool", async () => {
    const traces: string[] = [];
    let searches = 0;
    const invalidCall: OpenRouterToolCall = {
      id: "call-invalid",
      type: "function",
      function: { name: "search_public_web", arguments: JSON.stringify({ query: "x" }) },
    };
    let turns = 0;
    const model: Pick<OpenRouter, "complete"> = {
      async complete(): Promise<OpenRouterCompletion> {
        turns += 1;
        return turns === 1
          ? { content: null, toolCalls: [invalidCall] }
          : { content: null, toolCalls: [] };
      },
    };

    const result = await collectResearchEvidence({ runId, productUrl: "https://cartesia.ai/", audience: "AI engineers", objective: "awareness" }, {
      client: model,
      search: { async search() { searches += 1; return { outcome: "success" as const, results: [] }; } },
      fetcher: { async extract() { return { outcome: "partial" as const, code: "INVALID_URL" as const }; } },
      onTrace: async (trace) => { traces.push(trace.errorCode ?? ""); },
    });

    expect(result.evidence).toEqual([]);
    expect(result.limitations).toEqual(["MODEL_FINISHED_WITHOUT_FINISH_TOOL"]);
    expect(searches).toBe(0);
    expect(traces).toEqual(["INVALID_ARGUMENTS"]);
  });

  it("stops after eight search attempts", async () => {
    let searches = 0;
    let turns = 0;
    const model: Pick<OpenRouter, "complete"> = {
      async complete(): Promise<OpenRouterCompletion> {
        turns += 1;
        if (turns === 9) {
          return {
            content: null,
            toolCalls: [{ id: "finish", type: "function", function: { name: "finish_research", arguments: JSON.stringify({ reason: "budget_exhausted" }) } }],
          };
        }
        return {
          content: null,
          toolCalls: [{
            id: `call-${searches}`,
            type: "function",
            function: {
              name: "search_public_web",
              arguments: JSON.stringify({ query: "Cartesia launch", domains: ["cartesia.ai"], resultLimit: 5, purpose: "first_party_discovery" }),
            },
          }],
        };
      },
    };

    await collectResearchEvidence({ runId, productUrl: "https://cartesia.ai/", audience: "AI engineers", objective: "awareness" }, {
      client: model,
      search: { async search() { searches += 1; return { outcome: "success" as const, results: [] }; } },
      fetcher: { async extract() { return { outcome: "partial" as const, code: "INVALID_URL" as const }; } },
    });

    expect(searches).toBe(8);
  });
});

import { describe, expect, it } from "vitest";

import type { ApprovalCandidate } from "../src/server/repositories/approval-repository";
import { ApprovalService } from "../src/server/services/approval-service";
import { OwnerCapabilityService, matchesDemoExportCode } from "../src/server/services/owner-capability-service";

const runId = "6c4c1e99-7272-4d07-8382-dca1649112a9";
const sessionId = "d41dbad0-2f91-4f07-b8e9-73d7f90c08f7";
const evidenceIds = [
  "58a75de6-9ca4-47f5-a8fc-0cf9be2140e7",
  "bd5071a8-0c9f-455e-bf5f-d80c97e7e0c0",
  "b676dfa0-aef8-4695-b17e-b0dd4d71ab40",
];

function candidate(duplicateLane = false): ApprovalCandidate {
  return {
    evidence: evidenceIds.map((id) => ({
      id,
      runId,
      url: `https://example.com/${id}`,
      title: "Recorded evidence",
      publisher: "Example",
      sourceKind: "first_party" as const,
      excerpt: "A recorded product observation.",
      observations: [],
      roles: [],
      confidence: "high" as const,
      contentHash: id,
      retrievedAt: "2026-09-15T12:00:00.000Z",
    })),
    briefs: evidenceIds.map((primaryEvidenceId, index) => ({
      id: crypto.randomUUID(),
      runId,
      lane: duplicateLane ? "engineer_proof" as const : (["engineer_proof", "founder_consequence", "practitioner_reaction"] as const)[index]!,
      audienceLens: `Audience ${index}`,
      primaryEvidenceId,
      supportingEvidenceIds: [],
      hook: "A supported hook.",
      creatorPrompt: "Use the recorded source.",
      requiredAsset: "A source page",
      cta: "Review the source",
      prohibitedClaims: ["Do not invent outcomes."],
    })),
  };
}

describe("ApprovalService", () => {
  it("revalidates lanes and citations before recording approval", async () => {
    let created = false;
    const service = new ApprovalService({
      async loadCandidate() { return candidate(true); },
      async create() { created = true; return null; },
    });

    await expect(service.approve(runId, sessionId)).resolves.toEqual({ kind: "invalid_pack" });
    expect(created).toBe(false);
  });
});

describe("OwnerCapabilityService", () => {
  it("binds the short-lived capability to its issuing session", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const owners = new OwnerCapabilityService("x".repeat(32), () => now);
    const token = owners.issue(sessionId);

    expect(owners.isValidForSession(token.value, sessionId)).toBe(true);
    expect(owners.isValidForSession(token.value, runId)).toBe(false);
    expect(matchesDemoExportCode("presenter-code", "presenter-code")).toBe(true);
    expect(matchesDemoExportCode("wrong-code", "presenter-code")).toBe(false);
  });
});

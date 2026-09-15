import type { BriefPackProposal, CreatorBriefProposal } from "@/schemas/brief";
import type { Evidence } from "@/schemas/evidence";

export type BriefPackValidation =
  | { valid: true; briefs: CreatorBriefProposal[] }
  | { valid: false; reasons: string[] };

export function normalizeAudienceLens(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateBriefPack(
  proposal: BriefPackProposal,
  evidence: readonly Evidence[],
): BriefPackValidation {
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const lanes = new Set<string>();
  const audienceLenses = new Set<string>();
  const primaryEvidenceIds = new Set<string>();
  const reasons: string[] = [];

  for (const brief of proposal.briefs) {
    if (!lanes.add(brief.lane)) {
      reasons.push("Each brief must use a distinct lane.");
    }

    if (!audienceLenses.add(normalizeAudienceLens(brief.audienceLens))) {
      reasons.push("Each brief must use a distinct audience lens.");
    }

    if (!primaryEvidenceIds.add(brief.primaryEvidenceId)) {
      reasons.push("Each brief must use distinct primary evidence.");
    }

    for (const evidenceId of [brief.primaryEvidenceId, ...brief.supportingEvidenceIds]) {
      if (!evidenceIds.has(evidenceId)) {
        reasons.push(`Brief references evidence not present in the ledger: ${evidenceId}.`);
      }
    }
  }

  return reasons.length === 0
    ? { valid: true, briefs: proposal.briefs }
    : { valid: false, reasons: [...new Set(reasons)] };
}

export function hasUsableFirstPartyEvidence(evidence: readonly Evidence[]): boolean {
  return evidence.some((item) => item.sourceKind === "first_party" && item.excerpt.trim().length > 0);
}

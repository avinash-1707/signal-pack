import { randomUUID } from "node:crypto";

import type { CreatorBriefProposal } from "@/schemas/brief";
import type { ApprovalRepository } from "@/server/repositories/approval-repository";
import { validateBriefPack } from "@/server/services/brief-validation-service";

export type ApprovalResult =
  | { kind: "approved"; approvalId: string; approvedAt: Date }
  | { kind: "not_found" }
  | { kind: "invalid_pack" };

export class ApprovalService {
  constructor(private readonly approvals: Pick<ApprovalRepository, "loadCandidate" | "create">) {}

  async approve(runId: string, sessionId: string): Promise<ApprovalResult> {
    const candidate = await this.approvals.loadCandidate(runId, sessionId);
    if (!candidate) {
      return { kind: "not_found" };
    }
    const proposal = {
      briefs: candidate.briefs.map((brief): CreatorBriefProposal => ({
        lane: brief.lane,
        audienceLens: brief.audienceLens,
        primaryEvidenceId: brief.primaryEvidenceId,
        supportingEvidenceIds: brief.supportingEvidenceIds,
        hook: brief.hook,
        creatorPrompt: brief.creatorPrompt,
        requiredAsset: brief.requiredAsset,
        cta: brief.cta,
        prohibitedClaims: brief.prohibitedClaims,
      })),
    };
    if (!validateBriefPack(proposal, candidate.evidence).valid) {
      return { kind: "invalid_pack" };
    }

    const approval = await this.approvals.create(runId, sessionId, randomUUID());
    return approval
      ? { kind: "approved", approvalId: approval.id, approvedAt: approval.approvedAt }
      : { kind: "not_found" };
  }
}

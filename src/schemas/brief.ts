import { z } from "zod";

import { creatorLaneSchema } from "./domain";

const briefText = z.string().trim().min(1).max(2_000);

export const creatorBriefProposalSchema = z
  .object({
    lane: creatorLaneSchema,
    audienceLens: briefText.max(200),
    primaryEvidenceId: z.uuid(),
    supportingEvidenceIds: z.array(z.uuid()).max(11),
    hook: briefText,
    creatorPrompt: briefText,
    requiredAsset: briefText.max(500),
    cta: briefText.max(500),
    prohibitedClaims: z.array(briefText.max(500)).min(1).max(12),
  })
  .strict();

export const briefPackProposalSchema = z
  .object({
    briefs: z.array(creatorBriefProposalSchema).length(3),
  })
  .strict();

export const creatorBriefSchema = creatorBriefProposalSchema.extend({
  id: z.uuid(),
  runId: z.uuid(),
});

export type CreatorBrief = z.infer<typeof creatorBriefSchema>;
export type CreatorBriefProposal = z.infer<typeof creatorBriefProposalSchema>;
export type BriefPackProposal = z.infer<typeof briefPackProposalSchema>;

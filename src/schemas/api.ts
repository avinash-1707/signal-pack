import { z } from "zod";

import {
  confidenceSchema,
  creatorLaneSchema,
  objectiveSchema,
  runStatusSchema,
  sourceKindSchema,
  toolCallOutcomeSchema,
} from "./domain";

export const createRunRequestSchema = z
  .object({
    productUrl: z.url().max(2_048),
    objective: objectiveSchema,
    audience: z.string().min(3).max(200),
    launchDate: z.iso.date().nullable(),
    constraint: z.string().max(500).nullable(),
  })
  .strict();

export const createRunResponseSchema = z.object({
  runId: z.uuid(),
  status: z.literal("queued"),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export const evidenceResponseSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  title: z.string(),
  publisher: z.string(),
  sourceKind: sourceKindSchema,
  excerpt: z.string(),
  roles: z.array(z.string()),
  confidence: confidenceSchema,
  retrievedAt: z.iso.datetime(),
});

export const creatorBriefResponseSchema = z.object({
  id: z.uuid(),
  lane: creatorLaneSchema,
  audienceLens: z.string(),
  primaryEvidenceId: z.uuid(),
  supportingEvidenceIds: z.array(z.uuid()),
  hook: z.string(),
  creatorPrompt: z.string(),
  requiredAsset: z.string(),
  cta: z.string(),
  prohibitedClaims: z.array(z.string()),
});

export const getRunResponseSchema = z.object({
  id: z.uuid(),
  productUrl: z.url(),
  objective: objectiveSchema,
  audience: z.string(),
  launchDate: z.iso.date().nullable(),
  constraint: z.string().nullable(),
  status: runStatusSchema,
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  coverage: z.object({ found: z.array(z.string()), notFoundInThisRun: z.array(z.string()) }).nullable(),
  evidence: z.array(evidenceResponseSchema),
  briefs: z.array(creatorBriefResponseSchema),
  approval: z.object({ approvedAt: z.iso.datetime(), acknowledgmentVersion: z.literal("creator-brief-review-v1") }).nullable(),
  export: z.object({ provider: z.literal("google_sheets"), exportedAt: z.iso.datetime() }).nullable(),
  limitations: z.array(z.string()),
});

export const runSseEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run.status"),
    sequence: z.number().int().nonnegative(),
    status: runStatusSchema,
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("tool.completed"),
    sequence: z.number().int().nonnegative(),
    tool: z.enum(["search_public_web", "extract_public_page", "finish_research"]),
    outcome: toolCallOutcomeSchema,
    summary: z.string().max(280),
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("evidence.added"),
    sequence: z.number().int().nonnegative(),
    evidence: evidenceResponseSchema,
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("report.ready"),
    sequence: z.number().int().nonnegative(),
    runId: z.uuid(),
    status: z.enum(["awaiting_approval", "incomplete"]),
    at: z.iso.datetime(),
  }),
  z.object({
    type: z.literal("run.error"),
    sequence: z.number().int().nonnegative(),
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    at: z.iso.datetime(),
  }),
]);

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;
export type RunSseEvent = z.infer<typeof runSseEventSchema>;

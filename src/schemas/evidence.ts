import { z } from "zod";

import {
  assetRoleSchema,
  confidenceSchema,
  sourceKindSchema,
  toolCallOutcomeSchema,
} from "./domain";

export const searchPublicWebSchema = z
  .object({
    query: z.string().min(3).max(220),
    domains: z.array(z.string().max(253)).max(5).nullable(),
    resultLimit: z.union([z.literal(5), z.literal(10)]),
    purpose: z.enum(["first_party_discovery", "launch_context", "indexed_social_reference"]),
  })
  .strict();

export const extractPublicPageSchema = z
  .object({
    url: z.url().max(2_048),
    purpose: z.enum(["product_truth", "launch_asset", "founder_context", "third_party_context"]),
  })
  .strict();

export const finishResearchSchema = z
  .object({
    reason: z.enum(["sufficient_evidence", "source_exhausted", "budget_exhausted"]),
  })
  .strict();

export const evidenceSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  url: z.url(),
  title: z.string().min(1).max(300),
  publisher: z.string().min(1).max(253),
  sourceKind: sourceKindSchema,
  excerpt: z.string().min(1).max(4_000),
  observations: z.array(z.string().min(1).max(500)).max(12),
  roles: z.array(assetRoleSchema).max(6),
  confidence: confidenceSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
});

export const toolTraceSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  toolName: z.enum(["search_public_web", "extract_public_page", "finish_research"]),
  arguments: z.record(z.string(), z.unknown()),
  outcome: toolCallOutcomeSchema,
  latencyMs: z.number().int().nonnegative().nullable(),
  errorCode: z.string().max(100).nullable(),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type ExtractPublicPage = z.infer<typeof extractPublicPageSchema>;
export type SearchPublicWeb = z.infer<typeof searchPublicWebSchema>;
export type ToolTrace = z.infer<typeof toolTraceSchema>;

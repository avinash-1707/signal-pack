import { z } from "zod";

export const runStatusSchema = z.enum([
  "queued",
  "researching",
  "validating",
  "awaiting_approval",
  "incomplete",
  "complete",
  "exported",
]);

export const sourceKindSchema = z.enum([
  "first_party",
  "search_index",
  "third_party",
  "user_provided",
]);

export const assetRoleSchema = z.enum([
  "authority",
  "product_proof",
  "retention",
  "creator_narrative",
  "social_proof",
  "conversion",
]);

export const toolCallOutcomeSchema = z.enum(["success", "partial", "error"]);

export const objectiveSchema = z.enum([
  "awareness",
  "waitlist_signups",
  "demo_requests",
]);

export const creatorLaneSchema = z.enum([
  "engineer_proof",
  "founder_consequence",
  "practitioner_reaction",
]);

export const confidenceSchema = z.enum(["high", "medium", "low"]);

export type RunStatus = z.infer<typeof runStatusSchema>;
export type SourceKind = z.infer<typeof sourceKindSchema>;
export type AssetRole = z.infer<typeof assetRoleSchema>;
export type ToolCallOutcome = z.infer<typeof toolCallOutcomeSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type CreatorLane = z.infer<typeof creatorLaneSchema>;

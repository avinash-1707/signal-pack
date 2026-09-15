import cartesiaFixture from "../../../fixtures/cartesia-awareness-2026-09-15.json";

import { createRunRequestSchema, getRunResponseSchema } from "@/schemas/api";

import type { CreateRunInput, RunReport } from "./run-api-client";

const demoRunId = "6c4c1e99-7272-4d07-8382-dca1649112a9";
const evidenceIds = [
  "6432804a-6f9d-4127-8051-34dd3e0b4ad7",
  "11e896c7-972f-4beb-8b02-c078c7b2d8c7",
  "778a9a61-7f40-4734-a290-2c0ec8bae14a",
  "c3ea4b9b-5f58-4306-b70c-b937d7ac5d4b",
  "40d10161-2e74-489a-8f26-377261e2b2a9",
  "a3cb3150-079d-419f-a1c5-67b14b92190c",
  "f17962f1-bcf5-4f8f-b0b4-f31648025817",
  "f1aa7fba-3cee-4ac7-bac0-2d81bdebdc9b",
] as const;

export const cartesiaInput: CreateRunInput = createRunRequestSchema.parse(cartesiaFixture.input);

export const cartesiaDemoRun: RunReport = getRunResponseSchema.parse({
  id: demoRunId,
  ...cartesiaInput,
  status: "awaiting_approval",
  createdAt: "2026-09-15T12:00:00.000Z",
  completedAt: "2026-09-15T12:01:32.000Z",
  coverage: cartesiaFixture.expected.coverage,
  evidence: cartesiaFixture.evidence.map((item, index) => ({
    id: evidenceIds[index]!,
    ...item,
    sourceKind: "first_party",
    retrievedAt: "2026-09-15T12:00:00.000Z",
  })),
  briefs: [
    {
      id: "bb7e397e-7a4d-4feb-b558-85245f6d83c6",
      lane: "engineer_proof",
      audienceLens: "AI engineers",
      primaryEvidenceId: evidenceIds[0],
      supportingEvidenceIds: [evidenceIds[1]],
      hook: "Inspect the recorded product evidence.",
      creatorPrompt: "Walk through the documented technical context.",
      requiredAsset: "Product documentation",
      cta: "Review the evidence ledger",
      prohibitedClaims: ["Do not claim benchmark results."],
    },
    {
      id: "20cd5178-a0f5-4f73-a23f-20a0b0c89e16",
      lane: "founder_consequence",
      audienceLens: "Technical founders",
      primaryEvidenceId: evidenceIds[2],
      supportingEvidenceIds: [evidenceIds[3]],
      hook: "Frame the recorded launch context.",
      creatorPrompt: "Explain the documented launch trade-off.",
      requiredAsset: "Launch context",
      cta: "Inspect the cited sources",
      prohibitedClaims: ["Do not claim customer outcomes."],
    },
    {
      id: "dc3e0c0a-9255-4a84-8275-c70927f9023a",
      lane: "practitioner_reaction",
      audienceLens: "Product practitioners",
      primaryEvidenceId: evidenceIds[4],
      supportingEvidenceIds: [evidenceIds[5]],
      hook: "React to the recorded product context.",
      creatorPrompt: "Show how a practitioner can inspect the source material.",
      requiredAsset: "Product page",
      cta: "Read the source evidence",
      prohibitedClaims: ["Do not claim availability."],
    },
  ],
  approval: null,
  export: null,
  limitations: ["One source unavailable. Continuing with reduced coverage."],
});

export const cartesiaTrace = [
  { label: "Run queued", detail: "Public-source scope accepted.", state: "done" },
  { label: "Source discovery", detail: "First-party context located.", state: "done" },
  { label: "Page extraction", detail: "One source unavailable. Continuing with reduced coverage.", state: "partial" },
  { label: "Evidence validation", detail: "Citations checked against this run.", state: "done" },
  { label: "Brief compilation", detail: "Three distinct lanes prepared.", state: "done" },
] as const;

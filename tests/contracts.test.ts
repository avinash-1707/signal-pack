import { describe, expect, it } from "vitest";

import { createRunRequestSchema, runSseEventSchema } from "../src/schemas/api";
import { validateEnvironment } from "../src/schemas/env";

describe("create run contract", () => {
  it("rejects unexpected request fields", () => {
    const result = createRunRequestSchema.safeParse({
      productUrl: "https://cartesia.ai/",
      objective: "awareness",
      audience: "AI engineers",
      launchDate: null,
      constraint: null,
      injected: "not allowed",
    });

    expect(result.success).toBe(false);
  });

  it("accepts only documented SSE tool names", () => {
    const result = runSseEventSchema.safeParse({
      type: "tool.completed",
      sequence: 1,
      tool: "unrecognized_tool",
      outcome: "success",
      summary: "Completed",
      at: "2026-09-15T12:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });
});

describe("environment validation", () => {
  it("reports each missing live environment variable by name", () => {
    expect(validateEnvironment({})).toEqual([
      "BRAVE_SEARCH_API_KEY",
      "OPENROUTER_API_KEY",
      "RESEARCH_MODEL",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SHEET_ID",
      "DATABASE_URL",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
      "SESSION_SIGNING_SECRET",
      "DEMO_EXPORT_CODE",
      "CRON_SECRET",
    ]);
  });
});

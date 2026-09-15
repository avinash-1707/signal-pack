import { z } from "zod";

const requiredSecret = z.string().min(1);

export const environmentSchema = z.object({
  BRAVE_SEARCH_API_KEY: requiredSecret.optional(),
  OPENROUTER_API_KEY: requiredSecret.optional(),
  RESEARCH_MODEL: z.string().min(1).optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: requiredSecret.optional(),
  GOOGLE_SHEET_ID: z.string().min(1).optional(),
  DATABASE_URL: z.url().optional(),
  KV_REST_API_URL: z.url().optional(),
  KV_REST_API_TOKEN: requiredSecret.optional(),
  SESSION_SIGNING_SECRET: z.string().min(32).optional(),
  DEMO_EXPORT_CODE: requiredSecret.optional(),
  CRON_SECRET: requiredSecret.optional(),
});

export const requiredLiveEnvironmentKeys = [
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
] as const;

export function validateEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): string[] {
  const parsed = environmentSchema.safeParse(environment);
  const invalidKeys = new Set(
    parsed.success
      ? []
      : parsed.error.issues.map((issue) => String(issue.path[0] ?? "")),
  );

  return requiredLiveEnvironmentKeys.filter(
    (key) => !environment[key] || invalidKeys.has(key),
  );
}

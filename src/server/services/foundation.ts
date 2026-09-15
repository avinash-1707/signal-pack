import { createFixedWindowCounter } from "@/server/adapters/kv";
import { validateEnvironment } from "@/schemas/env";
import { database } from "@/server/adapters/database";
import { RunRepository } from "@/server/repositories/run-repository";
import { SessionRepository } from "@/server/repositories/session-repository";
import { RunLimits } from "@/server/services/run-limits";
import { RunService } from "@/server/services/run-service";
import { SessionService } from "@/server/services/session-service";

export function createFoundationServices(): {
  runs: RunService;
  sessions: SessionService;
} {
  const missing = validateEnvironment(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing or invalid environment values: ${missing.join(", ")}`);
  }

  const signingSecret = process.env.SESSION_SIGNING_SECRET;
  if (!signingSecret) {
    throw new Error("SESSION_SIGNING_SECRET is required");
  }

  const sessions = new SessionService(
    new SessionRepository(database),
    signingSecret,
  );
  return {
    runs: new RunService(
      new RunRepository(database),
      sessions,
      new RunLimits(createFixedWindowCounter()),
    ),
    sessions,
  };
}

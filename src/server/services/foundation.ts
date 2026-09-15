import { createFixedWindowCounter } from "@/server/adapters/kv";
import { validateEnvironment } from "@/schemas/env";
import { database } from "@/server/adapters/database";
import { GoogleSheetsAdapter } from "@/server/adapters/google-sheets";
import { ApprovalRepository } from "@/server/repositories/approval-repository";
import { RunRepository } from "@/server/repositories/run-repository";
import { SessionRepository } from "@/server/repositories/session-repository";
import { RunLimits } from "@/server/services/run-limits";
import { RunService } from "@/server/services/run-service";
import { SessionService } from "@/server/services/session-service";
import { ApprovalService } from "@/server/services/approval-service";
import { ExportService } from "@/server/services/export-service";
import { OwnerCapabilityService } from "@/server/services/owner-capability-service";

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

export function createApprovalServices(): {
  approvals: ApprovalService;
  exports: ExportService;
  owners: OwnerCapabilityService;
  sessions: SessionService;
  unlockAttempts: ReturnType<typeof createFixedWindowCounter>;
} {
  const foundation = createFoundationServices();
  const signingSecret = process.env.SESSION_SIGNING_SECRET;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!signingSecret || !spreadsheetId || !serviceAccountJson) {
    throw new Error("Approval and export environment values are required");
  }
  const approvals = new ApprovalRepository(database);
  return {
    approvals: new ApprovalService(approvals),
    exports: new ExportService(approvals, new GoogleSheetsAdapter(spreadsheetId, serviceAccountJson)),
    owners: new OwnerCapabilityService(signingSecret),
    sessions: foundation.sessions,
    unlockAttempts: createFixedWindowCounter(),
  };
}

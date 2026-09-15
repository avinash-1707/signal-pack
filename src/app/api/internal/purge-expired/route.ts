import { NextResponse } from "next/server";

import { database } from "@/server/adapters/database";
import { logEvent } from "@/server/logger";
import { SessionRepository } from "@/server/repositories/session-repository";
import { matchesCronSecret, RetentionService } from "@/server/services/retention-service";

async function purgeExpired(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !matchesCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });
  }

  const deletedSessionCount = await new RetentionService(
    new SessionRepository(database),
  ).purgeExpiredSessions();
  logEvent(console, "info", { event: "expired_sessions_purged", deletedSessionCount });
  return NextResponse.json({ deletedSessionCount });
}

export const GET = purgeExpired;
export const POST = purgeExpired;

import { NextResponse } from "next/server";

import { unlockExportRequestSchema } from "@/schemas/api";
import { setOwnerCookie, sessionCookieName } from "@/server/session-cookie";
import { createApprovalServices } from "@/server/services/foundation";
import { matchesDemoExportCode } from "@/server/services/owner-capability-service";

function sessionToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`))?.[1];
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid unlock request" }, { status: 400 });
  }
  const parsed = unlockExportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid unlock request" }, { status: 400 });
  }
  const services = createApprovalServices();
  const session = await services.sessions.get(sessionToken(request));
  if (!session) {
    return NextResponse.json({ code: "SESSION_REQUIRED", message: "Start a session-owned run before unlocking export" }, { status: 401 });
  }
  const attempt = await services.unlockAttempts.consume({
    key: `export-unlock:${session.id}`,
    limit: 5,
    windowMs: 15 * 60 * 1_000,
  });
  if (!attempt.allowed) {
    return NextResponse.json({ code: "EXPORT_UNLOCK_LIMIT_REACHED", message: "Too many unlock attempts" }, { status: 429 });
  }
  const configuredCode = process.env.DEMO_EXPORT_CODE;
  if (!configuredCode || !matchesDemoExportCode(parsed.data.code, configuredCode)) {
    return NextResponse.json({ code: "EXPORT_UNLOCK_DENIED", message: "The export code was not accepted" }, { status: 403 });
  }

  const token = services.owners.issue(session.id);
  const response = NextResponse.json({ unlockedUntil: token.expiresAt.toISOString() });
  setOwnerCookie(response, token);
  return response;
}

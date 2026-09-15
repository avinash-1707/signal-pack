import { NextResponse } from "next/server";

import { exportRunRequestSchema } from "@/schemas/api";
import { ownerCookieName, sessionCookieName } from "@/server/session-cookie";
import { createApprovalServices } from "@/server/services/foundation";

type Context = { params: Promise<{ runId: string }> };

function cookieValue(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
}

export async function POST(request: Request, { params }: Context): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid export request" }, { status: 400 });
  }
  const parsed = exportRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid export request" }, { status: 400 });
  }
  const services = createApprovalServices();
  const session = await services.sessions.get(cookieValue(request, sessionCookieName));
  if (!session) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Run not found" }, { status: 404 });
  }
  if (!services.owners.isValidForSession(cookieValue(request, ownerCookieName), session.id)) {
    return NextResponse.json({ code: "OWNER_EXPORT_REQUIRED", message: "Presenter export unlock is required" }, { status: 403 });
  }
  const { runId } = await params;
  const result = await services.exports.export(runId, session.id, parsed.data.idempotencyKey);
  switch (result.kind) {
    case "exported":
      return NextResponse.json({
        exportId: result.exportId,
        spreadsheetId: result.spreadsheetId,
        range: result.range,
        exportedAt: result.exportedAt.toISOString(),
      });
    case "not_found":
      return NextResponse.json({ code: "NOT_FOUND", message: "Run not found" }, { status: 404 });
    case "key_reused":
      return NextResponse.json({ code: "IDEMPOTENCY_KEY_REUSED", message: "This export key belongs to another run" }, { status: 409 });
    case "in_progress":
      return NextResponse.json({ code: "EXPORT_IN_PROGRESS", message: "This export is still being confirmed" }, { status: 409 });
    case "provider_failure":
      return NextResponse.json({ code: "EXPORT_RETRYABLE", message: "The approved pack was not exported. You can retry." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";

import { approveRunRequestSchema } from "@/schemas/api";
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
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid approval request" }, { status: 400 });
  }
  if (!approveRunRequestSchema.safeParse(body).success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid approval request" }, { status: 400 });
  }

  const services = createApprovalServices();
  const session = await services.sessions.get(cookieValue(request, sessionCookieName));
  if (!session) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Run not found" }, { status: 404 });
  }
  const { runId } = await params;
  const result = await services.approvals.approve(runId, session.id);
  if (result.kind === "not_found") {
    return NextResponse.json({ code: "NOT_FOUND", message: "Run not found" }, { status: 404 });
  }
  if (result.kind === "invalid_pack") {
    return NextResponse.json({ code: "PACK_INVALID", message: "The brief pack no longer meets approval requirements" }, { status: 409 });
  }
  return NextResponse.json({
    approvalId: result.approvalId,
    status: "awaiting_approval",
    approvedAt: result.approvedAt.toISOString(),
    exportEligible: services.owners.isValidForSession(cookieValue(request, ownerCookieName), session.id),
  });
}

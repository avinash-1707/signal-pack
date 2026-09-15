import { NextResponse } from "next/server";

import { getRunResponseSchema } from "@/schemas/api";
import { sessionCookieName } from "@/server/session-cookie";
import { createFoundationServices } from "@/server/services/foundation";

type Context = { params: Promise<{ runId: string }> };

export async function GET(request: Request, { params }: Context): Promise<NextResponse> {
  const { runId } = await params;
  const token = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`))?.[1];
  const run = await createFoundationServices().runs.getOwned(runId, token);
  if (!run) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Run not found" }, { status: 404 });
  }

  const response = getRunResponseSchema.parse({
    ...run,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    coverage: null,
    evidence: [],
    briefs: [],
    approval: run.approval && {
      approvedAt: run.approval.approvedAt.toISOString(),
      acknowledgmentVersion: run.approval.acknowledgmentVersion,
    },
    export: run.export && { provider: run.export.provider, exportedAt: run.export.exportedAt.toISOString() },
    limitations: [],
  });
  return NextResponse.json(response);
}

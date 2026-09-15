import { NextResponse } from "next/server";

import { createRunRequestSchema } from "@/schemas/api";
import { sessionCookieName, setSessionCookie } from "@/server/session-cookie";
import { createFoundationServices } from "@/server/services/foundation";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid run request" }, { status: 400 });
  }
  const parsed = createRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid run request" }, { status: 400 });
  }

  const services = createFoundationServices();
  const result = await services.runs.create(
    parsed.data,
    request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`))?.[1],
    getClientIp(request),
  );
  if (result.kind === "limited") {
    const status = result.limit.code === "DEMO_AT_CAPACITY" ? 503 : 429;
    return NextResponse.json(
      { code: result.limit.code, message: "Run creation limit reached" },
      { status },
    );
  }

  const response = NextResponse.json({ runId: result.runId, status: "queued" });
  setSessionCookie(response, result.token);
  return response;
}

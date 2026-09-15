import { NextResponse } from "next/server";

import { clearSessionCookies, sessionCookieName } from "@/server/session-cookie";
import { createFoundationServices } from "@/server/services/foundation";

export async function DELETE(request: Request): Promise<NextResponse> {
  const token = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`))?.[1];
  await createFoundationServices().sessions.delete(token);
  const response = NextResponse.json({ deleted: true });
  clearSessionCookies(response);
  return response;
}

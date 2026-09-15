import type { NextResponse } from "next/server";

import type { OwnerCapabilityToken } from "@/server/services/owner-capability-service";
import type { SessionToken } from "@/server/services/session-service";

export const sessionCookieName = "signal-pack-session";
export const ownerCookieName = "signal-pack-owner";

export function setSessionCookie(response: NextResponse, token: SessionToken | undefined): void {
  if (!token) {
    return;
  }

  response.cookies.set(sessionCookieName, token.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: token.expiresAt,
    path: "/",
  });
}

export function setOwnerCookie(response: NextResponse, token: OwnerCapabilityToken): void {
  response.cookies.set(ownerCookieName, token.value, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    expires: token.expiresAt,
    path: "/",
  });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(sessionCookieName, "", { httpOnly: true, secure: true, sameSite: "lax", expires: new Date(0), path: "/" });
  response.cookies.set(ownerCookieName, "", { httpOnly: true, secure: true, sameSite: "strict", expires: new Date(0), path: "/" });
}

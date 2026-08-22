import { NextResponse, type NextRequest } from "next/server";

import { isSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session-token";

/**
 * Cheap optimistic gate. Secure authorization remains in the server-only
 * page services, but an anonymous PWA launch must be redirected before React
 * starts rendering parallel layout/page segments.
 */
export function proxy(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken || !isSessionToken(rawToken)) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (rawToken) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
};

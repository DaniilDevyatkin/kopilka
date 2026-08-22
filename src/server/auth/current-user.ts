import "server-only";

import { cookies } from "next/headers";

import { AuthError } from "@/server/auth/errors";
import { authService } from "@/server/auth/index";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";

export async function requireAuthenticatedUser() {
  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return authService.authenticate(rawToken);
}

export async function getAuthenticatedUserOrNull() {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthError && error.code === "UNAUTHENTICATED") {
      return null;
    }
    throw error;
  }
}

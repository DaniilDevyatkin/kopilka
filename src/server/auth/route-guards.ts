import "server-only";

import { redirect } from "next/navigation";

import { resolveRouteAccess, type RouteArea } from "@/lib/navigation/routes";
import { getAuthenticatedUserOrNull } from "@/server/auth/current-user";
import type { AuthenticatedUser } from "@/server/auth/service";

async function guardRoute(area: RouteArea) {
  const user = await getAuthenticatedUserOrNull();
  const decision = resolveRouteAccess(user, area);

  if (!decision.allowed) redirect(decision.redirectTo);
  return user;
}

export async function guardPublicAuthRoute(): Promise<void> {
  await guardRoute("public-auth");
}

export async function guardOnboardingRoute(): Promise<AuthenticatedUser> {
  const user = await guardRoute("onboarding");
  if (!user) redirect("/login");
  return user;
}

export async function guardPrivateRoute(): Promise<AuthenticatedUser> {
  const user = await guardRoute("private");
  if (!user) redirect("/login");
  return user;
}

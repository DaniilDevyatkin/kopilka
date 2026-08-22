export const APP_ROUTES = [
  "/login",
  "/register",
  "/onboarding",
  "/app/home",
  "/app/accounts",
  "/app/accounts/[id]",
  "/app/transactions",
  "/app/goals",
  "/app/goals/new",
  "/app/goals/[id]",
  "/app/analytics",
  "/app/profile",
] as const;

export type RouteArea = "public-auth" | "onboarding" | "private";

export type RouteSessionState = {
  onboardingCompleted: boolean;
} | null;

export type RouteAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      redirectTo: "/login" | "/onboarding" | "/app/home";
    };

export function resolveRouteAccess(
  session: RouteSessionState,
  area: RouteArea,
): RouteAccessDecision {
  if (!session) {
    return area === "public-auth"
      ? { allowed: true }
      : { allowed: false, redirectTo: "/login" };
  }

  if (!session.onboardingCompleted) {
    return area === "onboarding"
      ? { allowed: true }
      : { allowed: false, redirectTo: "/onboarding" };
  }

  return area === "private"
    ? { allowed: true }
    : { allowed: false, redirectTo: "/app/home" };
}

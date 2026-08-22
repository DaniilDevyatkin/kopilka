import type { ReactNode } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { guardOnboardingRoute } from "@/server/auth/route-guards";

export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await guardOnboardingRoute();
  return <AuthShell>{children}</AuthShell>;
}

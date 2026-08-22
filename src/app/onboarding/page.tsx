import type { Metadata } from "next";

import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { guardOnboardingRoute } from "@/server/auth/route-guards";
import { onboardingService } from "@/server/onboarding/index";

export const metadata: Metadata = { title: "Настройка — Копилка" };

export default async function OnboardingPage() {
  const user = await guardOnboardingRoute();
  const state = await onboardingService.getState(user.id);
  return <OnboardingWizard initial={state} />;
}

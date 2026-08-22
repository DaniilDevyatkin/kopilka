import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { onboardingService } from "@/server/onboarding/index";
import type {
  SubmitAccountStepInput,
  SubmitBudgetStepInput,
  SubmitGoalStepInput,
} from "@/server/onboarding/validation";

async function authenticatedUserId(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}

export async function getOnboardingStateForCurrentUser() {
  return onboardingService.getState(await authenticatedUserId());
}

export async function submitAccountStepForCurrentUser(
  input: SubmitAccountStepInput,
) {
  return onboardingService.submitAccountStep(
    await authenticatedUserId(),
    input,
  );
}

export async function submitBudgetStepForCurrentUser(
  input: SubmitBudgetStepInput,
) {
  return onboardingService.submitBudgetStep(await authenticatedUserId(), input);
}

export async function submitGoalStepForCurrentUser(input: SubmitGoalStepInput) {
  return onboardingService.submitGoalStep(await authenticatedUserId(), input);
}

"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import {
  getOnboardingStateForCurrentUser,
  submitAccountStepForCurrentUser,
  submitBudgetStepForCurrentUser,
  submitGoalStepForCurrentUser,
} from "@/server/onboarding/current-user";
import { OnboardingError } from "@/server/onboarding/errors";
import type {
  SubmitAccountStepInput,
  SubmitBudgetStepInput,
  SubmitGoalStepInput,
} from "@/server/onboarding/validation";
import { AccountError } from "@/server/accounts/errors";
import { GoalError } from "@/server/goals/errors";

export type OnboardingActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof OnboardingError) {
    return { ok: false, code: error.code, message: "Проверьте данные шага." };
  }
  if (error instanceof AccountError || error instanceof GoalError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (error instanceof SameOriginError) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Не удалось подтвердить запрос.",
    };
  }
  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Не удалось выполнить запрос.",
  };
}

async function assertMutationSameOrigin(): Promise<void> {
  assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
}

export async function getOnboardingStateAction(): Promise<
  OnboardingActionResult<
    Awaited<ReturnType<typeof getOnboardingStateForCurrentUser>>
  >
> {
  try {
    return { ok: true, data: await getOnboardingStateForCurrentUser() };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function submitAccountStepAction(
  input: SubmitAccountStepInput,
): Promise<
  OnboardingActionResult<
    Awaited<ReturnType<typeof submitAccountStepForCurrentUser>>
  >
> {
  try {
    await assertMutationSameOrigin();
    return {
      ok: true,
      data: await submitAccountStepForCurrentUser(input),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function submitBudgetStepAction(
  input: SubmitBudgetStepInput,
): Promise<
  OnboardingActionResult<
    Awaited<ReturnType<typeof submitBudgetStepForCurrentUser>>
  >
> {
  try {
    await assertMutationSameOrigin();
    return {
      ok: true,
      data: await submitBudgetStepForCurrentUser(input),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function submitGoalStepAction(
  input: SubmitGoalStepInput,
): Promise<
  OnboardingActionResult<
    Awaited<ReturnType<typeof submitGoalStepForCurrentUser>>
  >
> {
  try {
    await assertMutationSameOrigin();
    return {
      ok: true,
      data: await submitGoalStepForCurrentUser(input),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

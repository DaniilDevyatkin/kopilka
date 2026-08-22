"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import {
  archiveGoalForCurrentUser,
  completeGoalForCurrentUser,
  contributeGoalForCurrentUser,
  createGoalForCurrentUser,
  getGoalForCurrentUser,
  listGoalsForCurrentUser,
  restoreGoalForCurrentUser,
  updateGoalForCurrentUser,
  withdrawGoalForCurrentUser,
} from "@/server/goals/current-user";
import { GoalError } from "@/server/goals/errors";
import type {
  CompleteGoalInput,
  ContributeGoalInput,
  CreateGoalInput,
  GoalListView,
  GoalReadModel,
  UpdateGoalInput,
  WithdrawGoalInput,
} from "@/server/goals/service";

export type GoalActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof GoalError) {
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

export async function createGoalAction(
  input: CreateGoalInput,
): Promise<
  GoalActionResult<Awaited<ReturnType<typeof createGoalForCurrentUser>>>
> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await createGoalForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function getGoalAction(
  goalId: unknown,
): Promise<GoalActionResult<GoalReadModel>> {
  try {
    return { ok: true, data: await getGoalForCurrentUser(goalId) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function listGoalsAction(
  view: GoalListView,
): Promise<GoalActionResult<GoalReadModel[]>> {
  try {
    return { ok: true, data: await listGoalsForCurrentUser(view) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function updateGoalAction(
  input: UpdateGoalInput,
): Promise<GoalActionResult<GoalReadModel>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await updateGoalForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function archiveGoalAction(
  goalId: unknown,
): Promise<GoalActionResult<GoalReadModel>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await archiveGoalForCurrentUser(goalId) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function contributeGoalAction(
  input: ContributeGoalInput,
): Promise<
  GoalActionResult<Awaited<ReturnType<typeof contributeGoalForCurrentUser>>>
> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await contributeGoalForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function restoreGoalAction(
  goalId: unknown,
): Promise<GoalActionResult<GoalReadModel>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await restoreGoalForCurrentUser(goalId) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function completeGoalAction(
  input: CompleteGoalInput,
): Promise<
  GoalActionResult<Awaited<ReturnType<typeof completeGoalForCurrentUser>>>
> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await completeGoalForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function withdrawGoalAction(
  input: WithdrawGoalInput,
): Promise<
  GoalActionResult<Awaited<ReturnType<typeof withdrawGoalForCurrentUser>>>
> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await withdrawGoalForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

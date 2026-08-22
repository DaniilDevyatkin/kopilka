import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { goalService } from "@/server/goals/index";
import type {
  CompleteGoalInput,
  ContributeGoalInput,
  CreateGoalInput,
  GoalListView,
  UpdateGoalInput,
  WithdrawGoalInput,
} from "@/server/goals/service";

async function authenticatedUserId(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}

export async function createGoalForCurrentUser(input: CreateGoalInput) {
  return goalService.createGoal(await authenticatedUserId(), input);
}

export async function getGoalForCurrentUser(goalId: unknown) {
  return goalService.getGoal(await authenticatedUserId(), goalId);
}

export async function listGoalsForCurrentUser(view: GoalListView) {
  return goalService.listGoals(await authenticatedUserId(), view);
}

export async function updateGoalForCurrentUser(input: UpdateGoalInput) {
  return goalService.updateGoal(await authenticatedUserId(), input);
}

export async function archiveGoalForCurrentUser(goalId: unknown) {
  return goalService.archiveGoal(await authenticatedUserId(), goalId);
}

export async function restoreGoalForCurrentUser(goalId: unknown) {
  return goalService.restoreGoal(await authenticatedUserId(), goalId);
}

export async function contributeGoalForCurrentUser(input: ContributeGoalInput) {
  return goalService.contributeGoal(await authenticatedUserId(), input);
}

export async function withdrawGoalForCurrentUser(input: WithdrawGoalInput) {
  return goalService.withdrawGoal(await authenticatedUserId(), input);
}

export async function completeGoalForCurrentUser(input: CompleteGoalInput) {
  return goalService.completeGoal(await authenticatedUserId(), input);
}

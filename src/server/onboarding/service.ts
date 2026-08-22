import "server-only";

import { randomInt } from "node:crypto";

import {
  OnboardingStep,
  type Account,
  type AccountType,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { AccountService } from "@/server/accounts/service";
import { AccountError } from "@/server/accounts/errors";
import { OnboardingError } from "@/server/onboarding/errors";
import type { GoalService } from "@/server/goals/service";
import { GoalError } from "@/server/goals/errors";
import {
  submitAccountStepInputSchema,
  submitBudgetStepInputSchema,
  submitGoalStepInputSchema,
  type SubmitAccountStepInput,
  type SubmitBudgetStepInput,
  type SubmitGoalStepInput,
} from "@/server/onboarding/validation";
import {
  serializeMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { resolveIanaTimeZone } from "@/lib/dates";

const ACCOUNT_STEP_KEY_PREFIX = "onboarding.account";
const GOAL_STEP_KEY_PREFIX = "onboarding.goal";

function generatedCardLast4(): string {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

export interface OnboardingStepReadModel {
  id: string;
  name: string;
  type: AccountType;
  currency: SupportedCurrency;
  visualTheme: string;
  balanceMinor: SerializedMoney;
}

export interface OnboardingStateReadModel {
  currentStep: "ACCOUNT" | "BUDGET" | "GOAL" | "COMPLETED";
  firstAccountCompletedAt: string | null;
  budgetCompletedAt: string | null;
  goalStepCompletedAt: string | null;
  goalStepSkippedAt: string | null;
  completedAt: string | null;
  user: {
    baseCurrency: SupportedCurrency;
    displayName: string | null;
  };
  settings: {
    monthlyIncomeMinor: SerializedMoney | null;
    mandatoryMonthlyExpensesMinor: SerializedMoney | null;
    timeZone: string;
  };
  account: OnboardingStepReadModel | null;
  accounts: OnboardingStepReadModel[];
  hasGoal: boolean;
}

interface OnboardingServiceDependencies {
  database: PrismaClient;
  accountService: Pick<AccountService, "createAccount">;
  goalService: Pick<GoalService, "createGoal">;
  now?: () => Date;
}

function serializeTimestamp(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function currencyOf(value: Account["currency"]): SupportedCurrency {
  return value as SupportedCurrency;
}

export function createOnboardingService(
  dependencies: OnboardingServiceDependencies,
) {
  const database = dependencies.database;
  const now = dependencies.now ?? (() => new Date());

  function assertParsed<T>(
    result: { success: true; data: T } | { success: false },
  ): T {
    if (!result.success) throw new OnboardingError("INVALID_INPUT");
    return result.data;
  }

  async function readState(userId: string): Promise<OnboardingStateReadModel> {
    const [state, settings, balances, goals] = await Promise.all([
      database.onboardingState.findUnique({ where: { userId } }),
      database.userSettings.findUnique({ where: { userId } }),
      database.ledgerEntry.groupBy({
        by: ["accountId"],
        where: { userId },
        _sum: { amountMinor: true },
      }),
      database.goal.count({
        where: { userId, status: { not: "ARCHIVED" } },
      }),
    ]);
    const user = await database.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true, displayName: true },
    });
    const accounts = await database.account.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        visualTheme: true,
      },
    });
    const balanceByAccount = new Map(
      balances.map((entry) => [entry.accountId, entry._sum.amountMinor ?? 0n]),
    );
    const summary = (account: {
      id: string;
      name: string;
      type: AccountType;
      currency: Account["currency"];
      visualTheme: string;
    }): OnboardingStepReadModel => ({
      id: account.id,
      name: account.name,
      type: account.type,
      currency: currencyOf(account.currency),
      visualTheme: account.visualTheme,
      balanceMinor: serializeMoney(balanceByAccount.get(account.id) ?? 0n),
    });

    const currentStep = state?.currentStep ?? OnboardingStep.ACCOUNT;
    return {
      currentStep,
      firstAccountCompletedAt: serializeTimestamp(
        state?.firstAccountCompletedAt ?? null,
      ),
      budgetCompletedAt: serializeTimestamp(state?.budgetCompletedAt ?? null),
      goalStepCompletedAt: serializeTimestamp(
        state?.goalStepCompletedAt ?? null,
      ),
      goalStepSkippedAt: serializeTimestamp(state?.goalStepSkippedAt ?? null),
      completedAt: serializeTimestamp(state?.completedAt ?? null),
      user: {
        baseCurrency: currencyOf(user.baseCurrency),
        displayName: user.displayName,
      },
      settings: {
        monthlyIncomeMinor:
          settings?.monthlyIncomeMinor !== null &&
          settings?.monthlyIncomeMinor !== undefined
            ? serializeMoney(settings.monthlyIncomeMinor)
            : null,
        mandatoryMonthlyExpensesMinor:
          settings?.mandatoryMonthlyExpensesMinor !== null &&
          settings?.mandatoryMonthlyExpensesMinor !== undefined
            ? serializeMoney(settings.mandatoryMonthlyExpensesMinor)
            : null,
        timeZone: resolveIanaTimeZone(settings?.timeZone),
      },
      account: accounts[0] ? summary(accounts[0]) : null,
      accounts: accounts.map(summary),
      hasGoal: goals > 0,
    };
  }

  async function submitAccountStep(
    userId: string,
    inputValue: SubmitAccountStepInput,
  ) {
    const input = assertParsed(
      submitAccountStepInputSchema.safeParse(inputValue),
    );
    const state = await database.onboardingState.findUnique({
      where: { userId },
    });
    if (
      !state ||
      state.completedAt !== null ||
      state.currentStep !== OnboardingStep.ACCOUNT
    ) {
      return readState(userId);
    }

    const existingAccounts = await database.account.count({
      where: { userId, archivedAt: null },
    });
    if (existingAccounts === 0) {
      const user = await database.user.findUnique({
        where: { id: userId },
        select: { baseCurrency: true },
      });
      if (user && user.baseCurrency !== "RUB") {
        await database.user.update({
          where: { id: userId },
          data: { baseCurrency: "RUB" },
        });
      }
      try {
        await dependencies.accountService.createAccount(userId, {
          ...input,
          type: "DEBIT_CARD",
          currency: "RUB",
          last4: generatedCardLast4(),
          idempotencyKey: `${ACCOUNT_STEP_KEY_PREFIX}.${userId}`,
        });
      } catch (error) {
        if (error instanceof AccountError) throw error;
        throw new OnboardingError("INVALID_INPUT");
      }
    }

    await database.onboardingState.update({
      where: { userId },
      data: {
        firstAccountCompletedAt: now(),
        currentStep: OnboardingStep.BUDGET,
      },
    });
    return readState(userId);
  }

  async function submitBudgetStep(
    userId: string,
    inputValue: SubmitBudgetStepInput,
  ) {
    const input = assertParsed(
      submitBudgetStepInputSchema.safeParse(inputValue),
    );
    const state = await database.onboardingState.findUnique({
      where: { userId },
    });
    if (
      !state ||
      state.completedAt !== null ||
      state.currentStep !== OnboardingStep.BUDGET
    ) {
      return readState(userId);
    }

    await database.userSettings.update({
      where: { userId },
      data: {
        monthlyIncomeMinor: input.monthlyIncomeMinor,
        mandatoryMonthlyExpensesMinor: input.mandatoryMonthlyExpensesMinor,
        timeZone: input.timeZone,
      },
    });
    await database.onboardingState.update({
      where: { userId },
      data: { budgetCompletedAt: now(), currentStep: OnboardingStep.GOAL },
    });
    return readState(userId);
  }

  async function submitGoalStep(
    userId: string,
    inputValue: SubmitGoalStepInput,
  ) {
    const input = assertParsed(submitGoalStepInputSchema.safeParse(inputValue));
    const state = await database.onboardingState.findUnique({
      where: { userId },
    });
    if (
      !state ||
      state.completedAt !== null ||
      state.currentStep !== OnboardingStep.GOAL ||
      state.goalStepCompletedAt !== null ||
      state.goalStepSkippedAt !== null
    ) {
      return readState(userId);
    }

    const settings = await database.userSettings.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    const repairedTimeZone = resolveIanaTimeZone(settings?.timeZone);
    if (settings && settings.timeZone !== repairedTimeZone) {
      await database.userSettings.update({
        where: { userId },
        data: { timeZone: repairedTimeZone },
      });
    }

    const existingGoals = await database.goal.count({
      where: { userId, status: { not: "ARCHIVED" } },
    });
    const completed = !input.skip || existingGoals > 0;

    if (!input.skip && existingGoals === 0) {
      const reservation =
        input.goal.alreadySavedMinor > 0n && input.goal.sourceAccountId
          ? {
              sourceAccountId: input.goal.sourceAccountId,
              amountMinor: input.goal.alreadySavedMinor,
              occurredAt: now().toISOString(),
            }
          : undefined;
      try {
        await dependencies.goalService.createGoal(userId, {
          name: input.goal.name,
          category: input.goal.category,
          targetAmountMinor: input.goal.targetAmountMinor,
          targetDate: input.goal.targetDate ?? null,
          priority: "MEDIUM",
          ...(reservation ? { initialReservation: reservation } : {}),
          idempotencyKey: `${GOAL_STEP_KEY_PREFIX}.${userId}`,
        });
      } catch (error) {
        if (error instanceof GoalError) throw error;
        throw new OnboardingError("INVALID_INPUT");
      }
    }

    await database.onboardingState.update({
      where: { userId },
      data: {
        currentStep: OnboardingStep.COMPLETED,
        completedAt: now(),
        goalStepCompletedAt: completed ? now() : null,
        goalStepSkippedAt: completed ? null : now(),
      },
    });
    return readState(userId);
  }

  return {
    getState: readState,
    submitAccountStep,
    submitBudgetStep,
    submitGoalStep,
  };
}

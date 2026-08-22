import { randomUUID } from "node:crypto";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  Currency,
  GoalReservationType,
  OnboardingStep,
  type PrismaClient,
} from "@/generated/prisma/client";
import { deserializeMoney } from "@/lib/money";
import { createAccountService } from "@/server/accounts/service";
import { createGoalService } from "@/server/goals/service";
import { GoalError } from "@/server/goals/errors";
import { OnboardingError } from "@/server/onboarding/errors";
import {
  createOnboardingService,
  type OnboardingStateReadModel,
} from "@/server/onboarding/service";
import {
  createOnboardingTestClient,
  prepareOnboardingTestDatabase,
} from "./onboarding-test-database";

const NOW = new Date("2026-08-15T10:00:00.000Z");
let database: PrismaClient;
let service: ReturnType<typeof createOnboardingService>;

async function createUser(label: string) {
  const user = await database.user.create({
    data: {
      loginNormalized: `${label}-${randomUUID()}`,
      loginDisplay: label,
      passwordHash: "integration-test-password-hash",
      baseCurrency: Currency.RUB,
      settings: { create: { timeZone: "Europe/Moscow" } },
      onboardingState: { create: {} },
      notification: { create: {} },
    },
  });
  return user.id;
}

async function ledgerTotal(userId: string): Promise<bigint> {
  const result = await database.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0n;
}

function accountInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Основная карта",
    visualTheme: "default",
    openingBalanceMinor: 100_000n,
    ...overrides,
  };
}

function budgetInput(overrides: Record<string, unknown> = {}) {
  return {
    monthlyIncomeMinor: 150_000n,
    mandatoryMonthlyExpensesMinor: 60_000n,
    timeZone: "Europe/Moscow",
    ...overrides,
  };
}

beforeAll(async () => {
  await prepareOnboardingTestDatabase();
  database = createOnboardingTestClient();
  service = createOnboardingService({
    database,
    accountService: createAccountService({ database, now: () => NOW }),
    goalService: createGoalService({ database, now: () => NOW }),
    now: () => NOW,
  });
});

afterAll(async () => {
  await database.$disconnect();
});

beforeEach(async () => {
  await database.goalReservationEntry.deleteMany();
  await database.ledgerEntry.deleteMany();
  await database.financialOperation.deleteMany();
  await database.goal.deleteMany();
  await database.idempotencyKey.deleteMany();
  await database.account.deleteMany();
  await database.category.deleteMany();
  await database.notificationPreference.deleteMany();
  await database.onboardingState.deleteMany();
  await database.userSettings.deleteMany();
  await database.user.deleteMany();
});

describe("onboarding full flow", () => {
  it("creates the first account and advances to the budget step", async () => {
    const userId = await createUser("flow");

    const state = await service.submitAccountStep(userId, accountInput());

    expect(state.currentStep).toBe(OnboardingStep.BUDGET);
    expect(state.firstAccountCompletedAt).not.toBeNull();
    expect(state.account).toMatchObject({
      name: "Основная карта",
      type: "DEBIT_CARD",
      currency: "RUB",
    });
    const createdAccount = await database.account.findFirstOrThrow({
      where: { userId },
    });
    expect(createdAccount.last4).toMatch(/^\d{4}$/u);
    expect(deserializeMoney(state.account?.balanceMinor ?? "0")).toBe(100_000n);
    expect(await database.account.count({ where: { userId } })).toBe(1);
    expect(await ledgerTotal(userId)).toBe(100_000n);
  });

  it("forces the first account and user base currency to RUB", async () => {
    const userId = await createUser("currency");
    await database.user.update({
      where: { id: userId },
      data: { baseCurrency: Currency.EUR },
    });

    await service.submitAccountStep(userId, accountInput());

    const user = await database.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(user.baseCurrency).toBe(Currency.RUB);
    const account = await database.account.findFirstOrThrow({
      where: { userId },
    });
    expect(account.currency).toBe(Currency.RUB);
    expect(account.type).toBe("DEBIT_CARD");
  });

  it("persists budget settings and advances to the goal step", async () => {
    const userId = await createUser("budget");
    await service.submitAccountStep(userId, accountInput());

    const state = await service.submitBudgetStep(userId, budgetInput());

    expect(state.currentStep).toBe(OnboardingStep.GOAL);
    expect(state.budgetCompletedAt).not.toBeNull();
    const settings = await database.userSettings.findUniqueOrThrow({
      where: { userId },
    });
    expect(settings.monthlyIncomeMinor).toBe(150_000n);
    expect(settings.mandatoryMonthlyExpensesMinor).toBe(60_000n);
    expect(settings.timeZone).toBe("Europe/Moscow");
  });

  it("creates the goal with a reservation and completes onboarding", async () => {
    const userId = await createUser("goal");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());

    const state = await service.submitGoalStep(userId, {
      skip: false,
      goal: {
        name: "Новый ноутбук",
        category: "TECH",
        targetAmountMinor: 250_000n,
        targetDate: "2026-12-31",
        alreadySavedMinor: 20_000n,
        sourceAccountId: (
          await database.account.findFirstOrThrow({
            where: { userId },
          })
        ).id,
      },
    });

    expect(state.currentStep).toBe(OnboardingStep.COMPLETED);
    expect(state.completedAt).not.toBeNull();
    expect(state.goalStepCompletedAt).not.toBeNull();
    expect(state.goalStepSkippedAt).toBeNull();

    const goal = await database.goal.findFirstOrThrow({ where: { userId } });
    expect(goal.name).toBe("Новый ноутбук");
    expect(goal.targetAmountMinor).toBe(250_000n);
    const reservation = await database.goalReservationEntry.findFirstOrThrow({
      where: { userId, goalId: goal.id },
    });
    expect(reservation.type).toBe(GoalReservationType.INITIAL_RESERVE);
    expect(reservation.amountMinor).toBe(20_000n);
    expect(await ledgerTotal(userId)).toBe(100_000n);
  });

  it("creates a goal without a reservation when nothing is saved now", async () => {
    const userId = await createUser("no-reserve");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());

    const state = await service.submitGoalStep(userId, {
      skip: false,
      goal: {
        name: "Подушка безопасности",
        category: "EMERGENCY_FUND",
        targetAmountMinor: 500_000n,
        alreadySavedMinor: 0n,
      },
    });

    expect(state.currentStep).toBe(OnboardingStep.COMPLETED);
    expect(await database.goal.count({ where: { userId } })).toBe(1);
    expect(
      await database.goalReservationEntry.count({ where: { userId } }),
    ).toBe(0);
    expect(await ledgerTotal(userId)).toBe(100_000n);
  });

  it("skipping the goal step completes onboarding without a goal", async () => {
    const userId = await createUser("skip");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());

    const state = await service.submitGoalStep(userId, { skip: true });

    expect(state.currentStep).toBe(OnboardingStep.COMPLETED);
    expect(state.completedAt).not.toBeNull();
    expect(state.goalStepSkippedAt).not.toBeNull();
    expect(state.goalStepCompletedAt).toBeNull();
    expect(await database.goal.count({ where: { userId } })).toBe(0);
  });

  it("fails when the reservation exceeds the account balance and keeps the step", async () => {
    const userId = await createUser("insufficient");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());

    await expect(
      service.submitGoalStep(userId, {
        skip: false,
        goal: {
          name: "Дорогая цель",
          category: "OTHER",
          targetAmountMinor: 500_000n,
          alreadySavedMinor: 500_000n,
          sourceAccountId: (
            await database.account.findFirstOrThrow({
              where: { userId },
            })
          ).id,
        },
      }),
    ).rejects.toBeInstanceOf(GoalError);

    const state = await service.getState(userId);
    expect(state.currentStep).toBe(OnboardingStep.GOAL);
    expect(await database.goal.count({ where: { userId } })).toBe(0);
  });

  it("rejects a budget where mandatory expenses exceed income", async () => {
    const userId = await createUser("bad-budget");
    await service.submitAccountStep(userId, accountInput());

    await expect(
      service.submitBudgetStep(
        userId,
        budgetInput({ mandatoryMonthlyExpensesMinor: 200_000n }),
      ),
    ).rejects.toBeInstanceOf(OnboardingError);

    const state = await service.getState(userId);
    expect(state.currentStep).toBe(OnboardingStep.BUDGET);
    const settings = await database.userSettings.findUniqueOrThrow({
      where: { userId },
    });
    expect(settings.monthlyIncomeMinor).toBe(0n);
  });

  it("rejects a goal step without a source account when saving money", async () => {
    const userId = await createUser("missing-source");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());

    await expect(
      service.submitGoalStep(userId, {
        skip: false,
        goal: {
          name: "Цель",
          category: "OTHER",
          targetAmountMinor: 50_000n,
          alreadySavedMinor: 5_000n,
        },
      }),
    ).rejects.toBeInstanceOf(OnboardingError);

    const state = await service.getState(userId);
    expect(state.currentStep).toBe(OnboardingStep.GOAL);
  });
});

describe("onboarding resume and idempotency", () => {
  it("resumes mid-way: submitting an already-completed step is a no-op", async () => {
    const userId = await createUser("resume");
    await service.submitAccountStep(userId, accountInput());
    await service.submitBudgetStep(userId, budgetInput());
    await service.submitGoalStep(userId, { skip: true });

    const state = await service.submitAccountStep(userId, accountInput());

    expect(state.currentStep).toBe(OnboardingStep.COMPLETED);
    expect(await database.account.count({ where: { userId } })).toBe(1);
    expect(await database.goal.count({ where: { userId } })).toBe(0);
  });

  it("resumes after a crash between account creation and step advance", async () => {
    const userId = await createUser("crash");
    await database.user.update({
      where: { id: userId },
      data: { baseCurrency: Currency.RUB },
    });
    await database.account.create({
      data: {
        userId,
        name: "Уже созданный счёт",
        type: "DEBIT_CARD",
        currency: Currency.RUB,
        visualTheme: "default",
      },
    });

    const state = await service.submitAccountStep(userId, accountInput());

    expect(state.currentStep).toBe(OnboardingStep.BUDGET);
    expect(await database.account.count({ where: { userId } })).toBe(1);
    const account = await database.account.findFirstOrThrow({
      where: { userId },
    });
    expect(account.name).toBe("Уже созданный счёт");
  });

  it("duplicate submits do not duplicate data", async () => {
    const userId = await createUser("duplicate");

    const first = await service.submitAccountStep(userId, accountInput());
    const second = await service.submitAccountStep(userId, accountInput());

    expect(first.currentStep).toBe(OnboardingStep.BUDGET);
    expect(second.currentStep).toBe(OnboardingStep.BUDGET);
    expect(await database.account.count({ where: { userId } })).toBe(1);
    expect(await ledgerTotal(userId)).toBe(100_000n);

    await service.submitBudgetStep(userId, budgetInput());
    await service.submitBudgetStep(userId, budgetInput());

    const settings = await database.userSettings.findUniqueOrThrow({
      where: { userId },
    });
    expect(settings.monthlyIncomeMinor).toBe(150_000n);

    const goalId = (
      await database.account.findFirstOrThrow({
        where: { userId },
      })
    ).id;
    await service.submitGoalStep(userId, {
      skip: false,
      goal: {
        name: "Одна цель",
        category: "OTHER",
        targetAmountMinor: 100_000n,
        alreadySavedMinor: 10_000n,
        sourceAccountId: goalId,
      },
    });
    await service.submitGoalStep(userId, {
      skip: false,
      goal: {
        name: "Одна цель",
        category: "OTHER",
        targetAmountMinor: 100_000n,
        alreadySavedMinor: 10_000n,
        sourceAccountId: goalId,
      },
    });

    expect(await database.goal.count({ where: { userId } })).toBe(1);
    expect(await ledgerTotal(userId)).toBe(100_000n);
    expect((await service.getState(userId)).currentStep).toBe(
      OnboardingStep.COMPLETED,
    );
  });

  it("survives a restart between steps (logout/login mid-way)", async () => {
    const userId = await createUser("restart");
    await service.submitAccountStep(userId, accountInput());

    const afterAccount: OnboardingStateReadModel =
      await service.getState(userId);
    expect(afterAccount.currentStep).toBe(OnboardingStep.BUDGET);
    expect(afterAccount.account?.name).toBe("Основная карта");

    await service.submitBudgetStep(userId, budgetInput());
    const afterBudget = await service.getState(userId);
    expect(afterBudget.currentStep).toBe(OnboardingStep.GOAL);
    expect(afterBudget.settings.monthlyIncomeMinor).toBe("150000");

    await service.submitGoalStep(userId, { skip: true });
    const afterGoal = await service.getState(userId);
    expect(afterGoal.currentStep).toBe(OnboardingStep.COMPLETED);
    expect(afterGoal.completedAt).not.toBeNull();
  });
});

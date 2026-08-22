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
  AccountType,
  CategoryKind,
  Currency,
  GoalCategory,
  GoalReservationType,
  OperationType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { createAccountService } from "@/server/accounts/service";
import { createCategoryService } from "@/server/categories/service";
import { createOperationService } from "@/server/operations/service";
import type { CreateOperationInput } from "@/server/operations/service";
import {
  createOperationTestClient,
  prepareOperationTestDatabase,
} from "./operation-test-database";

const NOW = new Date("2026-08-15T10:00:00.000Z");
const DAY_MS = 86_400_000;
let database: PrismaClient;

async function createUser(label: string, timeZone = "Asia/Yekaterinburg") {
  return database.user.create({
    data: {
      loginNormalized: `${label}-${randomUUID()}`,
      loginDisplay: label,
      passwordHash: "integration-test-password-hash",
      baseCurrency: Currency.RUB,
      settings: { create: { timeZone } },
      onboardingState: { create: {} },
      notification: { create: {} },
    },
  });
}

function accountService() {
  return createAccountService({ database, now: () => new Date(NOW) });
}

function operationService() {
  const now = () => new Date(NOW);
  return createOperationService({
    database,
    now,
    resolveOperationCategory: createCategoryService({ database, now })
      .resolveOperationCategory,
  });
}

function createOperationInput(
  overrides: Partial<CreateOperationInput> = {},
): CreateOperationInput {
  return {
    kind: "EXPENSE",
    amountMinor: 1_000n,
    accountId: "00000000-0000-0000-0000-000000000000",
    categoryId: "00000000-0000-0000-0000-000000000000",
    comment: "Тестовая операция",
    occurredAt: NOW.toISOString(),
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function createCustomCategory(userId: string, kind: CategoryKind) {
  return database.category.create({
    data: {
      ownerUserId: userId,
      kind,
      slug: `test-${randomUUID()}`,
      labelRu: `Тест ${kind}`,
      iconName: "tag",
    },
  });
}

async function countIncomeExpenseOperations() {
  return database.financialOperation.count({
    where: { type: { in: [OperationType.INCOME, OperationType.EXPENSE] } },
  });
}

async function countIncomeExpenseEntries() {
  return database.ledgerEntry.count({
    where: {
      operation: {
        type: { in: [OperationType.INCOME, OperationType.EXPENSE] },
      },
    },
  });
}

async function reserveFunds(
  userId: string,
  sourceAccountId: string,
  amountMinor: bigint,
) {
  const goal = await database.goal.create({
    data: {
      userId,
      name: "Цель",
      category: GoalCategory.OTHER,
      targetAmountMinor: 5_000n,
    },
  });
  await database.goalReservationEntry.create({
    data: {
      userId,
      goalId: goal.id,
      sourceAccountId,
      type: GoalReservationType.CONTRIBUTION,
      amountMinor,
      occurredAt: NOW,
    },
  });
}

beforeAll(async () => {
  await prepareOperationTestDatabase();
  database = createOperationTestClient();
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

afterAll(async () => {
  await database.$disconnect();
});

describe("server-only operations domain", () => {
  it("posts income as a positive entry and raises balance and total capital", async () => {
    const user = await createUser("income");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.INCOME);

    const result = await operationService().createOperation(
      user.id,
      createOperationInput({
        kind: "INCOME",
        amountMinor: 50_000n,
        accountId: account.account.id,
        categoryId: category.id,
      }),
    );

    expect(result).toMatchObject({
      replayed: false,
      operation: {
        type: OperationType.INCOME,
        accountId: account.account.id,
        categoryId: category.id,
        amountMinor: 50_000n,
        note: "Тестовая операция",
      },
    });
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 150_000n });
    expect(await accountService().getTotalCapital(user.id)).toBe(150_000n);
  });

  it("posts expense as a negative entry and lowers balance and total capital", async () => {
    const user = await createUser("expense");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);

    const result = await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 30_000n,
        accountId: account.account.id,
        categoryId: category.id,
      }),
    );

    expect(result.operation).toMatchObject({
      type: OperationType.EXPENSE,
      amountMinor: -30_000n,
    });
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 70_000n });
    expect(await accountService().getTotalCapital(user.id)).toBe(70_000n);
  });

  it("rejects zero and negative amounts", async () => {
    const user = await createUser("zero-amount");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 1_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);

    for (const amountMinor of [0n, -1n]) {
      await expect(
        operationService().createOperation(
          user.id,
          createOperationInput({
            amountMinor,
            accountId: account.account.id,
            categoryId: category.id,
          }),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(await countIncomeExpenseOperations()).toBe(0);
    expect(await countIncomeExpenseEntries()).toBe(0);
  });

  it("requires an unarchived category of the same kind owned by the user or system", async () => {
    const user = await createUser("category");
    const other = await createUser("other");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const incomeCategory = await createCustomCategory(
      user.id,
      CategoryKind.INCOME,
    );
    const foreignCategory = await createCustomCategory(
      other.id,
      CategoryKind.EXPENSE,
    );
    const archivedCategory = await database.category.create({
      data: {
        ownerUserId: user.id,
        kind: CategoryKind.EXPENSE,
        slug: `archived-${randomUUID()}`,
        labelRu: "Архивная",
        iconName: "tag",
        archivedAt: NOW,
      },
    });

    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          accountId: account.account.id,
          categoryId: incomeCategory.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          accountId: account.account.id,
          categoryId: foreignCategory.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          accountId: account.account.id,
          categoryId: archivedCategory.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
    expect(await countIncomeExpenseOperations()).toBe(0);
  });

  it("rejects expense that would make available funds negative, counting reserved money", async () => {
    const user = await createUser("funds");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 1_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    await reserveFunds(user.id, account.account.id, 800n);

    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          amountMinor: 300n,
          accountId: account.account.id,
          categoryId: category.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_AVAILABLE_FUNDS" });

    const allowed = await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 200n,
        accountId: account.account.id,
        categoryId: category.id,
      }),
    );
    expect(allowed.operation.amountMinor).toBe(-200n);
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 800n, reservedMinor: 800n });
  });

  it("enforces the documented credit floor and allows income onto a credit card", async () => {
    const user = await createUser("credit");
    const credit = await accountService().createAccount(user.id, {
      name: "Кредитка",
      type: AccountType.CREDIT_CARD,
      currency: Currency.RUB,
      creditLimitMinor: 20_000n,
      openingBalanceMinor: -5_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);

    const withinLimit = await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 15_000n,
        accountId: credit.account.id,
        categoryId: category.id,
      }),
    );
    expect(withinLimit.operation.amountMinor).toBe(-15_000n);
    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          amountMinor: 1n,
          accountId: credit.account.id,
          categoryId: category.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED" });

    const incomeCategory = await createCustomCategory(
      user.id,
      CategoryKind.INCOME,
    );
    const income = await operationService().createOperation(
      user.id,
      createOperationInput({
        kind: "INCOME",
        amountMinor: 10_000n,
        accountId: credit.account.id,
        categoryId: incomeCategory.id,
      }),
    );
    expect(income.operation.amountMinor).toBe(10_000n);
    expect(
      await accountService().getAccount(user.id, credit.account.id),
    ).toMatchObject({ balanceMinor: -10_000n });
  });

  it("rejects operations on archived accounts", async () => {
    const user = await createUser("archived-account");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    await accountService().archiveAccount(user.id, account.account.id);
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);

    await expect(
      operationService().createOperation(
        user.id,
        createOperationInput({
          accountId: account.account.id,
          categoryId: category.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });

  it("rejects occurredAt dates beyond the documented horizon", async () => {
    const user = await createUser("horizon");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const base = createOperationInput({
      amountMinor: 100n,
      accountId: account.account.id,
      categoryId: category.id,
    });
    const withDate = (occurredAt: string) => ({
      ...base,
      occurredAt,
      idempotencyKey: randomUUID(),
    });

    await expect(
      operationService().createOperation(
        user.id,
        withDate(new Date(NOW.getTime() + 32 * DAY_MS).toISOString()),
      ),
    ).rejects.toMatchObject({ code: "DATE_OUT_OF_RANGE" });
    await expect(
      operationService().createOperation(
        user.id,
        withDate(new Date(NOW.getTime() - 367 * DAY_MS).toISOString()),
      ),
    ).rejects.toMatchObject({ code: "DATE_OUT_OF_RANGE" });

    await expect(
      operationService().createOperation(
        user.id,
        withDate(new Date(NOW.getTime() + 31 * DAY_MS).toISOString()),
      ),
    ).resolves.toMatchObject({ operation: { amountMinor: -100n } });
    await expect(
      operationService().createOperation(
        user.id,
        withDate(new Date(NOW.getTime() - 366 * DAY_MS).toISOString()),
      ),
    ).resolves.toMatchObject({ operation: { amountMinor: -100n } });
  });

  it("applies the same idempotency key once and replays the stored operation", async () => {
    const user = await createUser("idempotency");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const input = createOperationInput({
      amountMinor: 1_000n,
      accountId: account.account.id,
      categoryId: category.id,
    });

    const first = await operationService().createOperation(user.id, input);
    const replay = await operationService().createOperation(user.id, input);

    expect(replay).toMatchObject({
      replayed: true,
      operation: { id: first.operation.id, amountMinor: -1_000n },
    });
    expect(await countIncomeExpenseOperations()).toBe(1);
    expect(await countIncomeExpenseEntries()).toBe(1);
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 99_000n });

    await expect(
      operationService().createOperation(user.id, {
        ...input,
        amountMinor: 2_000n,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("canonicalizes equivalent occurredAt offsets for idempotent replay", async () => {
    const user = await createUser("idempotency-timezone");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 10_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const input = createOperationInput({
      amountMinor: 1_000n,
      accountId: account.account.id,
      categoryId: category.id,
      occurredAt: "2026-08-15T15:00:00+05:00",
    });

    const first = await operationService().createOperation(user.id, input);
    const replay = await operationService().createOperation(user.id, {
      ...input,
      occurredAt: "2026-08-15T10:00:00Z",
    });

    expect(replay).toMatchObject({
      replayed: true,
      operation: { id: first.operation.id },
    });
    expect(await countIncomeExpenseEntries()).toBe(1);
  });

  it("replays a completed request even after its date leaves the creation horizon", async () => {
    const user = await createUser("idempotency-aged-replay");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 10_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    let currentTime = new Date(NOW);
    const service = createOperationService({
      database,
      now: () => new Date(currentTime),
      resolveOperationCategory: createCategoryService({ database })
        .resolveOperationCategory,
    });
    const input = createOperationInput({
      accountId: account.account.id,
      categoryId: category.id,
    });

    const first = await service.createOperation(user.id, input);
    currentTime = new Date(NOW.getTime() + 367 * DAY_MS);
    const replay = await service.createOperation(user.id, input);

    expect(replay).toMatchObject({
      replayed: true,
      operation: { id: first.operation.id },
    });
    expect(await countIncomeExpenseEntries()).toBe(1);
  });

  it("serializes a concurrent double tap into a single posting", async () => {
    const user = await createUser("double-tap");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const input = createOperationInput({
      amountMinor: 5_000n,
      accountId: account.account.id,
      categoryId: category.id,
    });

    const [first, second] = await Promise.all([
      operationService().createOperation(user.id, input),
      operationService().createOperation(user.id, input),
    ]);

    expect(second.operation.id).toBe(first.operation.id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(await countIncomeExpenseOperations()).toBe(1);
    expect(await countIncomeExpenseEntries()).toBe(1);
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 95_000n });
  });

  it("hides other users' accounts and rejects unknown fields", async () => {
    const user = await createUser("owner");
    const other = await createUser("intruder");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);

    await expect(
      operationService().createOperation(
        other.id,
        createOperationInput({
          accountId: account.account.id,
          categoryId: category.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(
      operationService().createOperation(
        other.id,
        createOperationInput({
          accountId: "00000000-0000-0000-0000-000000000000",
          categoryId: category.id,
        }),
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(
      operationService().createOperation(user.id, {
        ...createOperationInput({
          accountId: account.account.id,
          categoryId: category.id,
        }),
        unexpected: true,
      } as CreateOperationInput),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await countIncomeExpenseOperations()).toBe(0);
  });

  it("edits an expense atomically through a reversal and a replacement", async () => {
    const user = await createUser("edit-expense");
    const source = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const target = await accountService().createAccount(user.id, {
      name: "Запасной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 20_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const original = await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 10_000n,
        accountId: source.account.id,
        categoryId: category.id,
      }),
    );
    const input = {
      operationId: original.operation.id,
      kind: "EXPENSE" as const,
      amountMinor: 5_000n,
      accountId: target.account.id,
      categoryId: category.id,
      comment: "Исправленная покупка",
      occurredAt: NOW.toISOString(),
      idempotencyKey: randomUUID(),
    };

    const edited = await operationService().editOperation(user.id, input);
    const replay = await operationService().editOperation(user.id, input);

    expect(edited).toMatchObject({
      replayed: false,
      operation: {
        amountMinor: -5_000n,
        accountId: target.account.id,
        note: "Исправленная покупка",
      },
    });
    expect(replay).toMatchObject({
      replayed: true,
      operation: { id: edited.operation.id },
      reversalOperationId: edited.reversalOperationId,
    });
    expect(
      await database.financialOperation.findUnique({
        where: { id: edited.reversalOperationId },
      }),
    ).toMatchObject({
      type: OperationType.REVERSAL,
      reversesOperationId: original.operation.id,
    });
    expect(
      await database.financialOperation.findUnique({
        where: { id: edited.operation.id },
      }),
    ).toMatchObject({ supersedesOperationId: original.operation.id });
    expect(
      await accountService().getAccount(user.id, source.account.id),
    ).toMatchObject({ balanceMinor: 100_000n });
    expect(
      await accountService().getAccount(user.id, target.account.id),
    ).toMatchObject({ balanceMinor: 15_000n });
  });

  it("cancels an operation once and rejects cross-user cancellation", async () => {
    const user = await createUser("cancel-owner");
    const intruder = await createUser("cancel-intruder");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 100_000n,
      idempotencyKey: randomUUID(),
    });
    const category = await createCustomCategory(user.id, CategoryKind.EXPENSE);
    const original = await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 12_000n,
        accountId: account.account.id,
        categoryId: category.id,
      }),
    );
    const input = {
      operationId: original.operation.id,
      occurredAt: NOW.toISOString(),
      idempotencyKey: randomUUID(),
    };

    await expect(
      operationService().cancelOperation(intruder.id, input),
    ).rejects.toMatchObject({ code: "OPERATION_NOT_FOUND" });
    const cancelled = await operationService().cancelOperation(user.id, input);
    const replay = await operationService().cancelOperation(user.id, input);

    expect(cancelled).toMatchObject({
      cancelledOperationId: original.operation.id,
      replayed: false,
    });
    expect(replay).toEqual({ ...cancelled, replayed: true });
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 100_000n });
    await expect(
      operationService().cancelOperation(user.id, {
        ...input,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "OPERATION_IMMUTABLE" });
  });

  it("does not allow cancelling income after those funds were spent", async () => {
    const user = await createUser("cancel-spent-income");
    const account = await accountService().createAccount(user.id, {
      name: "Основной",
      type: AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      openingBalanceMinor: 0n,
      idempotencyKey: randomUUID(),
    });
    const incomeCategory = await createCustomCategory(
      user.id,
      CategoryKind.INCOME,
    );
    const expenseCategory = await createCustomCategory(
      user.id,
      CategoryKind.EXPENSE,
    );
    const income = await operationService().createOperation(
      user.id,
      createOperationInput({
        kind: "INCOME",
        amountMinor: 10_000n,
        accountId: account.account.id,
        categoryId: incomeCategory.id,
      }),
    );
    await operationService().createOperation(
      user.id,
      createOperationInput({
        amountMinor: 10_000n,
        accountId: account.account.id,
        categoryId: expenseCategory.id,
      }),
    );

    await expect(
      operationService().cancelOperation(user.id, {
        operationId: income.operation.id,
        occurredAt: NOW.toISOString(),
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_AVAILABLE_FUNDS" });
    expect(
      await accountService().getAccount(user.id, account.account.id),
    ).toMatchObject({ balanceMinor: 0n });
  });
});

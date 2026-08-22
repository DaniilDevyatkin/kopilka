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
  LedgerEntryRole,
  OperationType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { AccountError } from "@/server/accounts/errors";
import {
  createAccountService,
  type CreateAccountInput,
} from "@/server/accounts/service";
import {
  createAccountTestClient,
  prepareAccountTestDatabase,
} from "./account-test-database";

const NOW = new Date("2026-08-15T10:00:00.000Z");
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

function createInput(
  overrides: Partial<CreateAccountInput> = {},
): CreateAccountInput {
  return {
    name: "Основной счёт",
    type: AccountType.DEBIT_CARD,
    currency: Currency.RUB,
    visualTheme: "graphite",
    last4: "4821",
    openingBalanceMinor: 100_000n,
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function postEntry({
  userId,
  accountId,
  type,
  amountMinor,
  occurredAt,
}: {
  userId: string;
  accountId: string;
  type: OperationType;
  amountMinor: bigint;
  occurredAt: Date;
}) {
  const operation = await database.financialOperation.create({
    data: {
      userId,
      type,
      occurredAt,
    },
  });
  await database.ledgerEntry.create({
    data: {
      userId,
      operationId: operation.id,
      accountId,
      amountMinor,
      role: LedgerEntryRole.PRIMARY,
    },
  });
  return operation;
}

async function postTransfer({
  userId,
  sourceAccountId,
  destinationAccountId,
  amountMinor,
  occurredAt,
}: {
  userId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: bigint;
  occurredAt: Date;
}) {
  return database.$transaction(async (transaction) => {
    const operation = await transaction.financialOperation.create({
      data: { userId, type: OperationType.TRANSFER, occurredAt },
    });
    await transaction.ledgerEntry.createMany({
      data: [
        {
          userId,
          operationId: operation.id,
          accountId: sourceAccountId,
          amountMinor: -amountMinor,
          role: LedgerEntryRole.TRANSFER_SOURCE,
        },
        {
          userId,
          operationId: operation.id,
          accountId: destinationAccountId,
          amountMinor,
          role: LedgerEntryRole.TRANSFER_DESTINATION,
        },
      ],
    });
    return operation;
  });
}

beforeAll(async () => {
  await prepareAccountTestDatabase();
  database = createAccountTestClient();
});

beforeEach(async () => {
  await database.$transaction(async (transaction) => {
    await transaction.goalReservationEntry.deleteMany();
    await transaction.ledgerEntry.deleteMany();
    await transaction.financialOperation.deleteMany();
    await transaction.goal.deleteMany();
    await transaction.idempotencyKey.deleteMany();
    await transaction.account.deleteMany();
    await transaction.notificationPreference.deleteMany();
    await transaction.onboardingState.deleteMany();
    await transaction.userSettings.deleteMany();
    await transaction.user.deleteMany();
  });
});

afterAll(async () => {
  await database.$disconnect();
});

describe("server-only account domain", () => {
  it("creates every account type and derives opening balances from one operation and entry", async () => {
    const user = await createUser("types");
    const types = Object.values(AccountType);

    for (const type of types) {
      const credit = type === AccountType.CREDIT_CARD;
      const result = await accountService().createAccount(user.id, {
        ...createInput({
          name: type,
          type,
          last4: type === AccountType.DEBIT_CARD || credit ? "4821" : undefined,
          openingBalanceMinor: credit ? -5_000n : 10_000n,
          creditLimitMinor: credit ? 20_000n : undefined,
        }),
      });
      expect(result.account.balanceMinor).toBe(credit ? -5_000n : 10_000n);
      expect(result.openingOperationId).toBeTypeOf("string");
    }

    expect(await database.account.count()).toBe(types.length);
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.OPENING_BALANCE },
      }),
    ).toBe(types.length);
    expect(await database.ledgerEntry.count()).toBe(types.length);
  });

  it("applies create idempotently and leaves no empty opening operation for zero", async () => {
    const user = await createUser("create-idempotency");
    const input = createInput({
      type: AccountType.CASH,
      last4: undefined,
      openingBalanceMinor: 0n,
    });

    const first = await accountService().createAccount(user.id, input);
    const replay = await accountService().createAccount(user.id, input);

    expect(replay.account.id).toBe(first.account.id);
    expect(replay.replayed).toBe(true);
    expect(first.openingOperationId).toBeNull();
    expect(await database.account.count()).toBe(1);
    expect(await database.financialOperation.count()).toBe(0);
    expect(await database.ledgerEntry.count()).toBe(0);

    await expect(
      accountService().createAccount(user.id, {
        ...input,
        name: "Другой payload",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rolls back invalid account states and enforces the single user currency", async () => {
    const user = await createUser("invalid-create");

    await expect(
      accountService().createAccount(
        user.id,
        createInput({ openingBalanceMinor: -1n }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      accountService().createAccount(
        user.id,
        createInput({
          name: "4276 1234 5678 9012",
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      accountService().createAccount(
        user.id,
        createInput({
          type: AccountType.CASH,
          last4: "4821",
          openingBalanceMinor: 0n,
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      accountService().createAccount(
        user.id,
        createInput({
          currency: Currency.EUR,
          idempotencyKey: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });

    expect(await database.account.count()).toBe(0);
    expect(await database.financialOperation.count()).toBe(0);
    expect(await database.ledgerEntry.count()).toBe(0);
    expect(await database.idempotencyKey.count()).toBe(0);
  });

  it("serializes concurrent create and reconciliation commands without duplicate postings", async () => {
    const user = await createUser("concurrency");
    const input = createInput({ openingBalanceMinor: 1_000n });
    const [first, second] = await Promise.all([
      accountService().createAccount(user.id, input),
      accountService().createAccount(user.id, input),
    ]);

    expect(second.account.id).toBe(first.account.id);
    expect(await database.account.count()).toBe(1);
    expect(await database.ledgerEntry.count()).toBe(1);

    const [left, right] = await Promise.all([
      accountService().reconcileAccount(user.id, {
        accountId: first.account.id,
        actualBalanceMinor: 900n,
        idempotencyKey: randomUUID(),
      }),
      accountService().reconcileAccount(user.id, {
        accountId: first.account.id,
        actualBalanceMinor: 900n,
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect([left.deltaMinor, right.deltaMinor].sort()).toEqual([-100n, 0n]);
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.BALANCE_ADJUSTMENT },
      }),
    ).toBe(1);
    await expect(
      accountService().getAccount(user.id, first.account.id),
    ).resolves.toMatchObject({ balanceMinor: 900n });
  });

  it("reconciles by delta once and reconstructs balance only from ledger", async () => {
    const user = await createUser("reconcile");
    const created = await accountService().createAccount(
      user.id,
      createInput({ openingBalanceMinor: 54_200n }),
    );
    const input = {
      accountId: created.account.id,
      actualBalanceMinor: 53_870n,
      idempotencyKey: randomUUID(),
    };

    const adjusted = await accountService().reconcileAccount(user.id, input);
    const replay = await accountService().reconcileAccount(user.id, input);
    const noChange = await accountService().reconcileAccount(user.id, {
      ...input,
      idempotencyKey: randomUUID(),
    });

    expect(adjusted).toMatchObject({
      previousBalanceMinor: 54_200n,
      actualBalanceMinor: 53_870n,
      deltaMinor: -330n,
      changed: true,
      replayed: false,
    });
    expect(replay).toMatchObject({
      operationId: adjusted.operationId,
      deltaMinor: -330n,
      replayed: true,
    });
    expect(noChange).toMatchObject({ changed: false, deltaMinor: 0n });
    expect(
      await accountService().getAccount(user.id, created.account.id),
    ).toMatchObject({ balanceMinor: 53_870n });
    expect(
      await database.ledgerEntry.aggregate({
        where: { accountId: created.account.id },
        _sum: { amountMinor: true },
      }),
    ).toMatchObject({ _sum: { amountMinor: 53_870n } });
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.BALANCE_ADJUSTMENT },
      }),
    ).toBe(1);
  });

  it("calculates local-month inflow and outflow from occurredAt, excluding setup and adjustments", async () => {
    const user = await createUser("month-flow", "Asia/Yekaterinburg");
    const created = await accountService().createAccount(
      user.id,
      createInput({ openingBalanceMinor: 1_000n }),
    );
    const accountId = created.account.id;
    const counterparty = await accountService().createAccount(
      user.id,
      createInput({
        name: "Счёт-источник",
        type: AccountType.CASH,
        last4: undefined,
        openingBalanceMinor: 1_000n,
      }),
    );

    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.INCOME,
      amountMinor: 500n,
      occurredAt: new Date("2026-07-31T19:00:00.000Z"),
    });
    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.EXPENSE,
      amountMinor: -200n,
      occurredAt: new Date("2026-08-31T18:59:59.000Z"),
    });
    await postTransfer({
      userId: user.id,
      sourceAccountId: counterparty.account.id,
      destinationAccountId: accountId,
      amountMinor: 300n,
      occurredAt: new Date("2026-08-10T12:00:00.000Z"),
    });
    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.BALANCE_ADJUSTMENT,
      amountMinor: 100n,
      occurredAt: new Date("2026-08-10T12:00:00.000Z"),
    });
    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.INCOME,
      amountMinor: 999n,
      occurredAt: new Date("2026-08-31T19:00:00.000Z"),
    });

    await expect(
      accountService().getMonthFlow(user.id, accountId, "2026-08"),
    ).resolves.toEqual({ inflowMinor: 800n, outflowMinor: 200n });
  });

  it("edits safe metadata, archives without losing capital and rejects archived mutations", async () => {
    const user = await createUser("archive");
    const created = await accountService().createAccount(
      user.id,
      createInput(),
    );

    const edited = await accountService().updateAccount(user.id, {
      accountId: created.account.id,
      name: "Повседневные расходы",
      visualTheme: "forest",
      last4: "7788",
    });
    const archived = await accountService().archiveAccount(
      user.id,
      created.account.id,
    );

    expect(edited).toMatchObject({
      name: "Повседневные расходы",
      visualTheme: "forest",
      last4: "7788",
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(await accountService().getTotalCapital(user.id)).toBe(100_000n);
    await expect(
      accountService().reconcileAccount(user.id, {
        accountId: created.account.id,
        actualBalanceMinor: 90_000n,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });

  it("enforces reserves for non-credit accounts and an explicit debt floor for credit", async () => {
    const user = await createUser("funds");
    const debit = await accountService().createAccount(
      user.id,
      createInput({ openingBalanceMinor: 1_000n }),
    );
    const goal = await database.goal.create({
      data: {
        userId: user.id,
        name: "Цель",
        category: GoalCategory.OTHER,
        targetAmountMinor: 5_000n,
      },
    });
    await database.goalReservationEntry.create({
      data: {
        userId: user.id,
        goalId: goal.id,
        sourceAccountId: debit.account.id,
        type: GoalReservationType.CONTRIBUTION,
        amountMinor: 800n,
        occurredAt: NOW,
      },
    });

    await expect(
      accountService().reconcileAccount(user.id, {
        accountId: debit.account.id,
        actualBalanceMinor: 500n,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_AVAILABLE_FUNDS" });
    await expect(
      accountService().archiveAccount(user.id, debit.account.id),
    ).rejects.toMatchObject({ code: "ACTIVE_RESERVATION" });

    const credit = await accountService().createAccount(
      user.id,
      createInput({
        name: "Кредитная",
        type: AccountType.CREDIT_CARD,
        openingBalanceMinor: -500n,
        creditLimitMinor: 1_000n,
      }),
    );
    await expect(
      accountService().reconcileAccount(user.id, {
        accountId: credit.account.id,
        actualBalanceMinor: -1_001n,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED" });
    await expect(
      accountService().reconcileAccount(user.id, {
        accountId: credit.account.id,
        actualBalanceMinor: -900n,
        idempotencyKey: randomUUID(),
      }),
    ).resolves.toMatchObject({ changed: true, deltaMinor: -400n });
  });

  it("returns the same not-found result for foreign and missing account ids", async () => {
    const owner = await createUser("owner");
    const attacker = await createUser("attacker");
    const created = await accountService().createAccount(
      owner.id,
      createInput(),
    );

    for (const accountId of [created.account.id, randomUUID()]) {
      await expect(
        accountService().getAccount(attacker.id, accountId),
      ).rejects.toEqual(new AccountError("ACCOUNT_NOT_FOUND"));
      await expect(
        accountService().archiveAccount(attacker.id, accountId),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
      await expect(
        accountService().updateAccount(attacker.id, {
          accountId,
          name: "Чужое имя",
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
      await expect(
        accountService().getMonthFlow(attacker.id, accountId, "2026-08"),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
      await expect(
        accountService().reconcileAccount(attacker.id, {
          accountId,
          actualBalanceMinor: 0n,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
      await expect(
        accountService().deleteAccount(attacker.id, accountId),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    }
    await expect(
      accountService().getAccount(owner.id, created.account.id),
    ).resolves.toMatchObject({ name: "Основной счёт", balanceMinor: 100_000n });
  });

  it("scopes idempotency per user and rejects cross-user ledger links at the database boundary", async () => {
    const owner = await createUser("idempotency-owner");
    const another = await createUser("idempotency-another");
    const sharedKey = randomUUID();
    const ownerAccount = await accountService().createAccount(
      owner.id,
      createInput({ idempotencyKey: sharedKey }),
    );
    const anotherAccount = await accountService().createAccount(
      another.id,
      createInput({ idempotencyKey: sharedKey }),
    );
    expect(anotherAccount.account.id).not.toBe(ownerAccount.account.id);

    const ownerOperation = await database.financialOperation.findFirstOrThrow({
      where: { userId: owner.id, type: OperationType.OPENING_BALANCE },
    });
    await expect(
      database.ledgerEntry.create({
        data: {
          userId: another.id,
          operationId: ownerOperation.id,
          accountId: ownerAccount.account.id,
          amountMinor: 1n,
        },
      }),
    ).rejects.toBeDefined();
    expect(
      await database.ledgerEntry.count({
        where: { operationId: ownerOperation.id },
      }),
    ).toBe(1);
  });

  it("allows deletion only without history and relies on restrictive FKs against orphans", async () => {
    const user = await createUser("delete");
    const empty = await accountService().createAccount(
      user.id,
      createInput({
        name: "Пустой",
        type: AccountType.CASH,
        last4: undefined,
        openingBalanceMinor: 0n,
      }),
    );
    await accountService().reconcileAccount(user.id, {
      accountId: empty.account.id,
      actualBalanceMinor: 0n,
      idempotencyKey: randomUUID(),
    });
    await accountService().deleteAccount(user.id, empty.account.id);
    expect(
      await database.idempotencyKey.count({
        where: { resourceId: empty.account.id },
      }),
    ).toBe(0);

    const historical = await accountService().createAccount(
      user.id,
      createInput({ idempotencyKey: randomUUID() }),
    );
    await expect(
      accountService().deleteAccount(user.id, historical.account.id),
    ).rejects.toMatchObject({ code: "ACCOUNT_HAS_HISTORY" });
    await expect(
      database.account.delete({ where: { id: historical.account.id } }),
    ).rejects.toBeDefined();
    expect(
      await database.account.count({ where: { id: historical.account.id } }),
    ).toBe(1);
    expect(await database.ledgerEntry.count()).toBe(1);
  });

  it("lists active accounts first and archived accounts separately with balances", async () => {
    const user = await createUser("list");
    const cash = await accountService().createAccount(
      user.id,
      createInput({
        name: "Наличные",
        type: AccountType.CASH,
        last4: undefined,
        openingBalanceMinor: 5_000n,
      }),
    );
    const archived = await accountService().createAccount(
      user.id,
      createInput({
        name: "Старый счёт",
        openingBalanceMinor: 7_000n,
      }),
    );
    await accountService().archiveAccount(user.id, archived.account.id);

    const list = await accountService().listAccounts(user.id);
    expect(list.map((item) => item.name)).toEqual(["Старый счёт", "Наличные"]);
    const active = list.filter((item) => item.archivedAt === null);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      name: "Наличные",
      balanceMinor: 5_000n,
      currency: Currency.RUB,
      visualTheme: "graphite",
    });
    expect(list.find((item) => item.archivedAt !== null)).toMatchObject({
      name: "Старый счёт",
      balanceMinor: 7_000n,
    });
    expect(cash.account.id).not.toBe(archived.account.id);
  });

  it("builds the detail read model: month flow, 30-day series and categorized recent transactions", async () => {
    const user = await createUser("detail", "Asia/Yekaterinburg");
    const created = await accountService().createAccount(
      user.id,
      createInput({ openingBalanceMinor: 10_000n }),
    );
    const accountId = created.account.id;
    const category = await database.category.create({
      data: {
        ownerUserId: user.id,
        kind: CategoryKind.EXPENSE,
        slug: `test-${randomUUID()}`,
        labelRu: "Продукты",
        iconName: "cart",
      },
    });
    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.INCOME,
      amountMinor: 2_500n,
      occurredAt: new Date("2026-08-10T12:00:00.000Z"),
    });
    await postEntry({
      userId: user.id,
      accountId,
      type: OperationType.EXPENSE,
      amountMinor: -900n,
      occurredAt: new Date("2026-08-11T12:00:00.000Z"),
    });
    await database.financialOperation.update({
      where: {
        id: (
          await database.financialOperation.findFirstOrThrow({
            where: { userId: user.id, type: OperationType.EXPENSE },
          })
        ).id,
      },
      data: { categoryId: category.id, note: "Магнит" },
    });

    const detail = await accountService().getAccountDetail(user.id, accountId);

    expect(detail.account).toMatchObject({
      id: accountId,
      name: "Основной счёт",
      balanceMinor: 11_600n,
    });
    expect(detail.timeZone).toBe("Asia/Yekaterinburg");
    expect(detail.month).toMatchObject({
      yearMonth: "2026-08",
      inflowMinor: 2_500n,
      outflowMinor: 900n,
    });
    expect(detail.balanceSeries.length).toBeGreaterThan(0);
    expect(detail.balanceSeries.at(-1)).toMatchObject({
      day: "2026-08-15",
      balanceMinor: 11_600n,
    });
    const expenses = detail.recentTransactions.filter(
      (item) => item.type === OperationType.EXPENSE,
    );
    expect(expenses[0]).toMatchObject({
      categoryLabel: "Продукты",
      categoryIcon: "cart",
      note: "Магнит",
      amountMinor: -900n,
    });
    expect(detail.recentTransactions[0]).toMatchObject({
      type: OperationType.OPENING_BALANCE,
    });
  });
});

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
  Currency,
  GoalCategory,
  GoalReservationType,
  LedgerEntryRole,
  OperationType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { createAccountService } from "@/server/accounts/service";
import {
  createTransferService,
  type CreateTransferInput,
} from "@/server/transfers/service";
import {
  createTransferTestClient,
  prepareTransferTestDatabase,
} from "./transfer-test-database";

const NOW = new Date("2026-08-15T10:00:00.000Z");
let database: PrismaClient;

async function createUser(label: string) {
  return database.user.create({
    data: {
      loginNormalized: `${label}-${randomUUID()}`,
      loginDisplay: label,
      passwordHash: "integration-test-password-hash",
      baseCurrency: Currency.RUB,
      settings: { create: {} },
      onboardingState: { create: {} },
      notification: { create: {} },
    },
  });
}

function accountService() {
  return createAccountService({ database, now: () => new Date(NOW) });
}

function transferService() {
  return createTransferService({ database, now: () => new Date(NOW) });
}

async function createAccount(
  userId: string,
  name: string,
  openingBalanceMinor: bigint,
  type: AccountType = AccountType.DEBIT_CARD,
) {
  return accountService().createAccount(userId, {
    name,
    type,
    currency: Currency.RUB,
    ...(type === AccountType.CREDIT_CARD ? { creditLimitMinor: 100_000n } : {}),
    ...(type === AccountType.DEBIT_CARD || type === AccountType.CREDIT_CARD
      ? { last4: "4821" }
      : {}),
    openingBalanceMinor,
    idempotencyKey: randomUUID(),
  });
}

function transferInput(
  sourceAccountId: string,
  destinationAccountId: string,
  overrides: Partial<CreateTransferInput> = {},
): CreateTransferInput {
  return {
    amountMinor: 30_000n,
    sourceAccountId,
    destinationAccountId,
    comment: "Перевод между своими счетами",
    occurredAt: NOW.toISOString(),
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function totalCapital(userId: string) {
  return accountService().getTotalCapital(userId);
}

beforeAll(async () => {
  await prepareTransferTestDatabase();
  database = createTransferTestClient();
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

describe("server-only transfer domain", () => {
  it("creates one header and two balanced entries without changing capital", async () => {
    const user = await createUser("create");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const destination = await createAccount(user.id, "Накопительный", 10_000n);
    const capitalBefore = await totalCapital(user.id);

    const result = await transferService().createTransfer(
      user.id,
      transferInput(source.account.id, destination.account.id),
    );

    expect(result).toMatchObject({
      replayed: false,
      transfer: {
        type: OperationType.TRANSFER,
        sourceAccountId: source.account.id,
        destinationAccountId: destination.account.id,
        amountMinor: 30_000n,
      },
    });
    expect(result.transfer.entries).toEqual([
      expect.objectContaining({
        accountId: source.account.id,
        amountMinor: -30_000n,
        role: LedgerEntryRole.TRANSFER_SOURCE,
      }),
      expect.objectContaining({
        accountId: destination.account.id,
        amountMinor: 30_000n,
        role: LedgerEntryRole.TRANSFER_DESTINATION,
      }),
    ]);
    expect(await totalCapital(user.id)).toBe(capitalBefore);
    await expect(
      accountService().getAccount(user.id, source.account.id),
    ).resolves.toMatchObject({ balanceMinor: 70_000n });
    await expect(
      accountService().getAccount(user.id, destination.account.id),
    ).resolves.toMatchObject({ balanceMinor: 40_000n });
  });

  it("replays a repeated or concurrent double tap exactly once", async () => {
    const user = await createUser("replay");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const destination = await createAccount(user.id, "Накопительный", 0n);
    const input = transferInput(source.account.id, destination.account.id);

    const [first, second] = await Promise.all([
      transferService().createTransfer(user.id, input),
      transferService().createTransfer(user.id, input),
    ]);
    const replay = await transferService().createTransfer(user.id, input);

    expect(second.transfer.id).toBe(first.transfer.id);
    expect(replay.transfer.id).toBe(first.transfer.id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(replay.replayed).toBe(true);
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.TRANSFER },
      }),
    ).toBe(1);
    expect(await database.ledgerEntry.count()).toBe(3);
    expect(await totalCapital(user.id)).toBe(100_000n);
    await expect(
      transferService().createTransfer(user.id, {
        ...input,
        amountMinor: 20_000n,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("rejects same-account, currency mismatch and archived accounts atomically", async () => {
    const user = await createUser("validation");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const destination = await createAccount(user.id, "Накопительный", 0n);
    const euro = await database.account.create({
      data: {
        userId: user.id,
        name: "Евро",
        type: AccountType.CASH,
        currency: Currency.EUR,
      },
    });

    await expect(
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, source.account.id),
      ),
    ).rejects.toMatchObject({ code: "SAME_ACCOUNT" });
    await expect(
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, euro.id),
      ),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });

    await accountService().archiveAccount(user.id, destination.account.id);
    await expect(
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, destination.account.id),
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.TRANSFER },
      }),
    ).toBe(0);
  });

  it("protects reserved funds and serializes competing transfers", async () => {
    const user = await createUser("funds");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const left = await createAccount(user.id, "Левый", 0n);
    const right = await createAccount(user.id, "Правый", 0n);
    const goal = await database.goal.create({
      data: {
        userId: user.id,
        name: "Цель",
        category: GoalCategory.OTHER,
        targetAmountMinor: 100_000n,
      },
    });
    await database.goalReservationEntry.create({
      data: {
        userId: user.id,
        goalId: goal.id,
        sourceAccountId: source.account.id,
        type: GoalReservationType.CONTRIBUTION,
        amountMinor: 30_000n,
        occurredAt: NOW,
      },
    });

    const outcomes = await Promise.allSettled([
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, left.account.id, {
          amountMinor: 60_000n,
        }),
      ),
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, right.account.id, {
          amountMinor: 60_000n,
        }),
      ),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    expect(
      outcomes.find((outcome) => outcome.status === "rejected"),
    ).toMatchObject({
      reason: { code: "INSUFFICIENT_AVAILABLE_FUNDS" },
    });
    expect(await totalCapital(user.id)).toBe(100_000n);
  });

  it("uses the documented debt floor for a credit-card source", async () => {
    const user = await createUser("credit");
    const source = await createAccount(
      user.id,
      "Кредитная карта",
      -5_000n,
      AccountType.CREDIT_CARD,
    );
    const destination = await createAccount(user.id, "Основной", 0n);
    const capitalBefore = await totalCapital(user.id);

    await expect(
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, destination.account.id, {
          amountMinor: 95_000n,
        }),
      ),
    ).resolves.toMatchObject({ transfer: { amountMinor: 95_000n } });
    await expect(
      transferService().createTransfer(
        user.id,
        transferInput(source.account.id, destination.account.id, {
          amountMinor: 1n,
        }),
      ),
    ).rejects.toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED" });
    expect(await totalCapital(user.id)).toBe(capitalBefore);
  });

  it("rejects cross-user account access like a missing account", async () => {
    const owner = await createUser("owner");
    const attacker = await createUser("attacker");
    const source = await createAccount(owner.id, "Основной", 100_000n);
    const destination = await createAccount(owner.id, "Накопительный", 0n);

    for (const accountId of [source.account.id, randomUUID()]) {
      await expect(
        transferService().createTransfer(
          attacker.id,
          transferInput(accountId, destination.account.id),
        ),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    }
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.TRANSFER },
      }),
    ).toBe(0);
  });

  it("edits the whole transfer through one reversal and one replacement", async () => {
    const user = await createUser("edit");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const oldDestination = await createAccount(user.id, "Старый", 0n);
    const newDestination = await createAccount(user.id, "Новый", 0n);
    const original = await transferService().createTransfer(
      user.id,
      transferInput(source.account.id, oldDestination.account.id),
    );
    const editInput = {
      transferId: original.transfer.id,
      ...transferInput(source.account.id, newDestination.account.id, {
        amountMinor: 20_000n,
      }),
    };

    const edited = await transferService().editTransfer(user.id, editInput);
    const replay = await transferService().editTransfer(user.id, editInput);

    expect(edited).toMatchObject({
      replayed: false,
      transfer: {
        sourceAccountId: source.account.id,
        destinationAccountId: newDestination.account.id,
        amountMinor: 20_000n,
      },
    });
    expect(replay).toMatchObject({
      replayed: true,
      reversalOperationId: edited.reversalOperationId,
      transfer: { id: edited.transfer.id },
    });
    const reversal = await database.financialOperation.findUniqueOrThrow({
      where: { id: edited.reversalOperationId },
      include: { ledgerEntries: true },
    });
    expect(reversal).toMatchObject({
      type: OperationType.REVERSAL,
      reversesOperationId: original.transfer.id,
    });
    expect(reversal.ledgerEntries).toHaveLength(2);
    expect(
      reversal.ledgerEntries.reduce(
        (sum, entry) => sum + entry.amountMinor,
        0n,
      ),
    ).toBe(0n);
    expect(edited.transfer.supersedesOperationId).toBe(original.transfer.id);
    await expect(
      accountService().getAccount(user.id, source.account.id),
    ).resolves.toMatchObject({ balanceMinor: 80_000n });
    await expect(
      accountService().getAccount(user.id, oldDestination.account.id),
    ).resolves.toMatchObject({ balanceMinor: 0n });
    await expect(
      accountService().getAccount(user.id, newDestination.account.id),
    ).resolves.toMatchObject({ balanceMinor: 20_000n });
    expect(await totalCapital(user.id)).toBe(100_000n);
  });

  it("cancels the entire active transfer and replays cancellation once", async () => {
    const user = await createUser("cancel");
    const source = await createAccount(user.id, "Основной", 100_000n);
    const destination = await createAccount(user.id, "Накопительный", 0n);
    const original = await transferService().createTransfer(
      user.id,
      transferInput(source.account.id, destination.account.id),
    );
    const input = {
      transferId: original.transfer.id,
      comment: "Отмена перевода",
      occurredAt: NOW.toISOString(),
      idempotencyKey: randomUUID(),
    };

    const cancelled = await transferService().cancelTransfer(user.id, input);
    const replay = await transferService().cancelTransfer(user.id, input);

    expect(replay).toEqual({ ...cancelled, replayed: true });
    const reversal = await database.financialOperation.findUniqueOrThrow({
      where: { id: cancelled.reversalOperationId },
      include: { ledgerEntries: true },
    });
    expect(reversal).toMatchObject({
      type: OperationType.REVERSAL,
      reversesOperationId: original.transfer.id,
    });
    expect(reversal.ledgerEntries).toHaveLength(2);
    expect(
      reversal.ledgerEntries.reduce(
        (sum, entry) => sum + entry.amountMinor,
        0n,
      ),
    ).toBe(0n);
    expect(await totalCapital(user.id)).toBe(100_000n);
    await expect(
      accountService().getAccount(user.id, source.account.id),
    ).resolves.toMatchObject({ balanceMinor: 100_000n });
    await expect(
      accountService().getAccount(user.id, destination.account.id),
    ).resolves.toMatchObject({ balanceMinor: 0n });
  });

  it("rejects cross-user edit/cancel and competing lifecycle mutations", async () => {
    const owner = await createUser("lifecycle-owner");
    const attacker = await createUser("lifecycle-attacker");
    const source = await createAccount(owner.id, "Основной", 100_000n);
    const destination = await createAccount(owner.id, "Накопительный", 0n);
    const original = await transferService().createTransfer(
      owner.id,
      transferInput(source.account.id, destination.account.id),
    );

    await expect(
      transferService().cancelTransfer(attacker.id, {
        transferId: original.transfer.id,
        occurredAt: NOW.toISOString(),
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "TRANSFER_NOT_FOUND" });
    await expect(
      transferService().editTransfer(attacker.id, {
        transferId: original.transfer.id,
        ...transferInput(source.account.id, destination.account.id),
      }),
    ).rejects.toMatchObject({ code: "TRANSFER_NOT_FOUND" });

    const outcomes = await Promise.allSettled([
      transferService().cancelTransfer(owner.id, {
        transferId: original.transfer.id,
        occurredAt: NOW.toISOString(),
        idempotencyKey: randomUUID(),
      }),
      transferService().cancelTransfer(owner.id, {
        transferId: original.transfer.id,
        occurredAt: NOW.toISOString(),
        idempotencyKey: randomUUID(),
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    expect(
      outcomes.find((outcome) => outcome.status === "rejected"),
    ).toMatchObject({
      reason: { code: "TRANSFER_NOT_ACTIVE" },
    });
    expect(await totalCapital(owner.id)).toBe(100_000n);
  });

  it("enforces the two-entry invariant at the PostgreSQL transaction boundary", async () => {
    const user = await createUser("db-invariant");
    const source = await createAccount(user.id, "Основной", 100_000n);

    await expect(
      database.$transaction(async (transaction) => {
        const header = await transaction.financialOperation.create({
          data: {
            userId: user.id,
            type: OperationType.TRANSFER,
            occurredAt: NOW,
          },
        });
        await transaction.ledgerEntry.create({
          data: {
            userId: user.id,
            operationId: header.id,
            accountId: source.account.id,
            amountMinor: -1_000n,
            role: LedgerEntryRole.TRANSFER_SOURCE,
          },
        });
      }),
    ).rejects.toBeDefined();
    expect(
      await database.financialOperation.count({
        where: { type: OperationType.TRANSFER },
      }),
    ).toBe(0);
  });
});

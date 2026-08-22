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
  GoalPriority,
  GoalReservationType,
  GoalStatus,
  LedgerEntryRole,
  OperationType,
  type PrismaClient,
} from "@/generated/prisma/client";
import { MAX_MONEY_MINOR } from "@/lib/money";
import type { GoalDomainEvent } from "@/server/goals/domain-events";
import { GoalError } from "@/server/goals/errors";
import {
  createGoalService,
  type CompleteGoalInput,
  type ContributeGoalInput,
  type CreateGoalInput,
  type UpdateGoalInput,
} from "@/server/goals/service";
import {
  createGoalTestClient,
  prepareGoalTestDatabase,
} from "./goal-test-database";

const NOW = new Date("2026-08-11T10:00:00.000Z");
let database: PrismaClient;

async function createUser(label: string) {
  return database.user.create({
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
}

async function createImage(userId: string, label: string) {
  return database.imageAsset.create({
    data: {
      userId,
      storageKey: `goals/${userId}/${label}-${randomUUID()}.webp`,
      mimeType: "image/webp",
      byteSize: 12_345n,
      width: 1200,
      height: 800,
      integrityHash: "a".repeat(64),
    },
  });
}

async function createAccountWithBalance(
  userId: string,
  label: string,
  balanceMinor: bigint,
  overrides: Partial<{
    type: AccountType;
    creditLimitMinor: bigint | null;
  }> = {},
) {
  const account = await database.account.create({
    data: {
      userId,
      name: `РЎС‡С‘С‚ ${label}`,
      type: overrides.type ?? AccountType.DEBIT_CARD,
      currency: Currency.RUB,
      visualTheme: "default",
      ...(overrides.creditLimitMinor !== undefined
        ? { creditLimitMinor: overrides.creditLimitMinor }
        : {}),
    },
  });
  if (balanceMinor !== 0n) {
    const operation = await database.financialOperation.create({
      data: {
        userId,
        type: OperationType.OPENING_BALANCE,
        occurredAt: NOW,
      },
    });
    await database.ledgerEntry.create({
      data: {
        userId,
        operationId: operation.id,
        accountId: account.id,
        amountMinor: balanceMinor,
        role: LedgerEntryRole.PRIMARY,
      },
    });
  }
  return account;
}

async function ledgerTotal(userId: string): Promise<bigint> {
  const result = await database.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0n;
}

async function accountFreeMoney(userId: string, accountId: string) {
  const [balance, reserved] = await Promise.all([
    database.ledgerEntry.aggregate({
      where: { userId, accountId },
      _sum: { amountMinor: true },
    }),
    database.goalReservationEntry.aggregate({
      where: { userId, sourceAccountId: accountId },
      _sum: { amountMinor: true },
    }),
  ]);
  return {
    balanceMinor: balance._sum.amountMinor ?? 0n,
    reservedMinor: reserved._sum.amountMinor ?? 0n,
    freeMinor:
      (balance._sum.amountMinor ?? 0n) - (reserved._sum.amountMinor ?? 0n),
  };
}

function reserveInput(
  goalId: string,
  sourceAccountId: string,
  overrides: Partial<ContributeGoalInput> = {},
): ContributeGoalInput {
  return {
    goalId,
    sourceAccountId,
    amountMinor: 20_000_00n,
    occurredAt: NOW.toISOString(),
    note: "РќР° С†РµР»СЊ",
    idempotencyKey: `goal-reserve-${randomUUID()}`,
    ...overrides,
  };
}

function completeInput(
  goalId: string,
  paymentAccountId: string,
  overrides: Partial<CompleteGoalInput> = {},
): CompleteGoalInput {
  return {
    goalId,
    paymentAccountId,
    actualPurchaseAmountMinor: 160_000_00n,
    occurredAt: NOW.toISOString(),
    note: "РљСѓРїР»РµРЅРѕ",
    idempotencyKey: `goal-complete-${randomUUID()}`,
    ...overrides,
  };
}

function goalService(publishEvent?: (event: GoalDomainEvent) => void) {
  return createGoalService({
    database,
    now: () => new Date(NOW),
    ...(publishEvent ? { publishEvent } : {}),
  });
}

function createGoalInput(
  overrides: Partial<CreateGoalInput> = {},
): CreateGoalInput {
  return {
    name: "MacBook",
    category: "TECH",
    description: "Р Р°Р±РѕС‡РёР№ РЅРѕСѓС‚Р±СѓРє",
    targetAmountMinor: 160_000_00n,
    targetDate: "2027-04-18",
    priority: "MEDIUM",
    idempotencyKey: `goal-create-${randomUUID()}`,
    ...overrides,
  };
}

beforeAll(async () => {
  await prepareGoalTestDatabase();
  database = createGoalTestClient();
});

beforeEach(async () => {
  await database.goalReservationEntry.deleteMany();
  await database.ledgerEntry.deleteMany();
  await database.financialOperation.deleteMany();
  await database.idempotencyKey.deleteMany();
  await database.goal.deleteMany();
  await database.imageAsset.deleteMany();
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

describe("server-only Goal domain", () => {
  it("creates an active goal with owned image metadata without creating money", async () => {
    const user = await createUser("create");
    const image = await createImage(user.id, "macbook");

    const result = await goalService().createGoal(
      user.id,
      createGoalInput({ imageAssetId: image.id, priority: "HIGH" }),
    );

    expect(result.replayed).toBe(false);
    expect(result.initialReservationEntryId).toBeNull();
    expect(result.goal).toMatchObject({
      name: "MacBook",
      category: GoalCategory.TECH,
      priority: GoalPriority.HIGH,
      status: GoalStatus.ACTIVE,
      targetAmountMinor: 160_000_00n,
      reservedAmountMinor: 0n,
      actualPurchaseAmountMinor: null,
      completedAt: null,
      archivedAt: null,
      image: {
        id: image.id,
        mimeType: "image/webp",
        byteSize: 12_345n,
        width: 1200,
        height: 800,
        integrityHash: "a".repeat(64),
      },
    });
    expect(result.goal.createdAt).toBeInstanceOf(Date);
    expect(result.goal.updatedAt).toBeInstanceOf(Date);
    expect(await database.financialOperation.count()).toBe(0);
    expect(await database.ledgerEntry.count()).toBe(0);
    expect(await database.goalReservationEntry.count()).toBe(0);
  });

  it("replays create idempotently and rejects the same key with another payload", async () => {
    const user = await createUser("idempotency");
    const input = createGoalInput({ idempotencyKey: "goal-create-stable-key" });

    const created = await goalService().createGoal(user.id, input);
    const replayed = await goalService().createGoal(user.id, input);

    expect(replayed).toMatchObject({
      replayed: true,
      initialReservationEntryId: null,
      goal: { id: created.goal.id },
    });
    expect(await database.goal.count()).toBe(1);
    expect(await database.idempotencyKey.count()).toBe(1);
    await expect(
      goalService().createGoal(user.id, {
        ...input,
        name: "Р”СЂСѓРіРѕР№ payload",
      }),
    ).rejects.toEqual(new GoalError("IDEMPOTENCY_CONFLICT"));
  });

  it("supports all categories and high/medium/low priorities", async () => {
    const user = await createUser("catalog");
    const categories = [
      "TECH",
      "TRAVEL",
      "CAR",
      "HOUSING",
      "EDUCATION",
      "GIFT",
      "CLOTHES",
      "HEALTH",
      "HOBBY",
      "EMERGENCY_FUND",
      "OTHER",
    ] as const;
    const priorities = ["HIGH", "MEDIUM", "LOW"] as const;

    for (const [index, category] of categories.entries()) {
      await goalService().createGoal(
        user.id,
        createGoalInput({
          name: `Р¦РµР»СЊ ${index}`,
          category,
          priority: priorities[index % priorities.length],
          idempotencyKey: `goal-catalog-${index}`,
        }),
      );
    }

    const goals = await goalService().listGoals(user.id, "ACTIVE");
    expect(new Set(goals.map((goal) => goal.category))).toEqual(
      new Set(categories),
    );
    expect(new Set(goals.map((goal) => goal.priority))).toEqual(
      new Set([GoalPriority.HIGH, GoalPriority.MEDIUM, GoalPriority.LOW]),
    );
  });

  it("validates target amount, past dates and text boundaries", async () => {
    const user = await createUser("validation");
    const invalid: CreateGoalInput[] = [
      createGoalInput({ targetAmountMinor: 0n }),
      createGoalInput({ targetAmountMinor: MAX_MONEY_MINOR + 1n }),
      createGoalInput({ targetDate: "2026-08-10" }),
      createGoalInput({ targetDate: "2026-02-30" }),
      createGoalInput({ name: "   " }),
      createGoalInput({ description: "x".repeat(1001) }),
    ];

    for (const input of invalid) {
      await expect(
        goalService().createGoal(user.id, input),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/INVALID_INPUT|TARGET_DATE_IN_PAST/u),
      });
    }
    expect(await database.goal.count()).toBe(0);
  });

  it("reads, edits, archives, lists and deliberately restores a goal", async () => {
    const user = await createUser("crud");
    const image = await createImage(user.id, "crud");
    const created = await goalService().createGoal(
      user.id,
      createGoalInput({ imageAssetId: image.id }),
    );
    const update: UpdateGoalInput = {
      goalId: created.goal.id,
      name: "РџРѕРµР·РґРєР°",
      category: "TRAVEL",
      description: null,
      targetAmountMinor: 200_000_00n,
      targetDate: null,
      priority: "LOW",
      imageAssetId: null,
    };

    const updated = await goalService().updateGoal(user.id, update);
    expect(updated).toMatchObject({
      id: created.goal.id,
      name: "РџРѕРµР·РґРєР°",
      category: GoalCategory.TRAVEL,
      description: null,
      targetAmountMinor: 200_000_00n,
      targetDate: null,
      priority: GoalPriority.LOW,
      image: null,
      status: GoalStatus.ACTIVE,
    });
    await expect(
      goalService().getGoal(user.id, created.goal.id),
    ).resolves.toMatchObject({
      id: created.goal.id,
    });

    const archived = await goalService().archiveGoal(user.id, created.goal.id);
    expect(archived.status).toBe(GoalStatus.ARCHIVED);
    expect(archived.archivedAt).toEqual(NOW);
    expect(await goalService().listGoals(user.id, "ACTIVE")).toHaveLength(0);
    expect(await goalService().listGoals(user.id, "ARCHIVE")).toEqual([
      expect.objectContaining({ id: created.goal.id }),
    ]);
    await expect(
      goalService().updateGoal(user.id, {
        goalId: created.goal.id,
        name: "РќРµР»СЊР·СЏ",
      }),
    ).rejects.toEqual(new GoalError("GOAL_NOT_EDITABLE"));

    const restored = await goalService().restoreGoal(user.id, created.goal.id);
    expect(restored.status).toBe(GoalStatus.ACTIVE);
    expect(restored.archivedAt).toBeNull();
    await expect(
      goalService().restoreGoal(user.id, created.goal.id),
    ).resolves.toMatchObject({
      status: GoalStatus.ACTIVE,
    });
  });

  it("preserves reservation history and refuses archive while reserve is open", async () => {
    const user = await createUser("history");
    const account = await database.account.create({
      data: {
        userId: user.id,
        name: "РќР°РєРѕРїРёС‚РµР»СЊРЅС‹Р№",
        type: AccountType.SAVINGS,
        currency: Currency.RUB,
        visualTheme: "default",
      },
    });
    const created = await goalService().createGoal(user.id, createGoalInput());
    await database.goalReservationEntry.create({
      data: {
        userId: user.id,
        goalId: created.goal.id,
        sourceAccountId: account.id,
        type: GoalReservationType.INITIAL_RESERVE,
        amountMinor: 20_000_00n,
        occurredAt: NOW,
      },
    });

    await expect(
      goalService().archiveGoal(user.id, created.goal.id),
    ).rejects.toEqual(new GoalError("ACTIVE_RESERVATION"));
    expect(
      (await goalService().getGoal(user.id, created.goal.id))
        .reservedAmountMinor,
    ).toBe(20_000_00n);

    await database.goalReservationEntry.create({
      data: {
        userId: user.id,
        goalId: created.goal.id,
        sourceAccountId: account.id,
        type: GoalReservationType.RELEASE_ON_ARCHIVE,
        amountMinor: -20_000_00n,
        occurredAt: NOW,
      },
    });
    await expect(
      goalService().archiveGoal(user.id, created.goal.id),
    ).resolves.toMatchObject({ status: GoalStatus.ARCHIVED });
    expect(
      await database.goalReservationEntry.count({
        where: { goalId: created.goal.id },
      }),
    ).toBe(2);
  });

  it("persists a real initial reservation through createGoal without creating money", async () => {
    const user = await createUser("initial-reserve");
    const account = await createAccountWithBalance(
      user.id,
      "initial",
      100_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const input = createGoalInput({
      initialReservation: {
        sourceAccountId: account.id,
        amountMinor: 20_000_00n,
        occurredAt: NOW.toISOString(),
        note: "РЈР¶Рµ РЅР°РєРѕРїР»РµРЅРѕ",
      },
      idempotencyKey: "goal-create-initial-reserve",
    });

    const created = await goalService().createGoal(user.id, input);
    expect(created.replayed).toBe(false);
    expect(created.initialReservationEntryId).not.toBeNull();
    expect(created.goal.reservedAmountMinor).toBe(20_000_00n);

    const entry = await database.goalReservationEntry.findFirstOrThrow({
      where: { id: created.initialReservationEntryId ?? "" },
    });
    expect(entry).toMatchObject({
      userId: user.id,
      goalId: created.goal.id,
      sourceAccountId: account.id,
      type: GoalReservationType.INITIAL_RESERVE,
      amountMinor: 20_000_00n,
      note: "РЈР¶Рµ РЅР°РєРѕРїР»РµРЅРѕ",
    });
    expect(await ledgerTotal(user.id)).toBe(before);
    expect(
      await database.financialOperation.count({ where: { userId: user.id } }),
    ).toBe(1);

    const replayed = await goalService().createGoal(user.id, input);
    expect(replayed).toMatchObject({
      replayed: true,
      initialReservationEntryId: created.initialReservationEntryId,
      goal: { id: created.goal.id },
    });
    expect(await database.goalReservationEntry.count()).toBe(1);
  });

  it("rolls back the whole goal when the initial reservation does not fit the account", async () => {
    const user = await createUser("initial-reserve-fail");
    const poor = await createAccountWithBalance(user.id, "poor", 5_000_00n);
    const foreign = await createUser("foreign-account");

    await expect(
      goalService().createGoal(
        user.id,
        createGoalInput({
          initialReservation: {
            sourceAccountId: poor.id,
            amountMinor: 20_000_00n,
            occurredAt: NOW.toISOString(),
          },
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE"));
    await expect(
      goalService().createGoal(
        user.id,
        createGoalInput({
          initialReservation: {
            sourceAccountId: foreign.id,
            amountMinor: 20_000_00n,
            occurredAt: NOW.toISOString(),
          },
        }),
      ),
    ).rejects.toEqual(new GoalError("ACCOUNT_NOT_FOUND"));
    expect(await database.goal.count()).toBe(0);
    expect(await database.goalReservationEntry.count()).toBe(0);
  });

  it("does not reactivate or edit a completed goal", async () => {
    const user = await createUser("completed");
    const created = await goalService().createGoal(user.id, createGoalInput());
    await database.goal.update({
      where: { id: created.goal.id },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: NOW,
        archivedAt: NOW,
        actualPurchaseAmountMinor: 155_000_00n,
      },
    });

    const completed = await goalService().getGoal(user.id, created.goal.id);
    expect(completed).toMatchObject({
      status: GoalStatus.COMPLETED,
      actualPurchaseAmountMinor: 155_000_00n,
      completedAt: NOW,
      archivedAt: NOW,
    });
    await expect(
      goalService().restoreGoal(user.id, created.goal.id),
    ).rejects.toEqual(new GoalError("GOAL_NOT_RESTORABLE"));
    await expect(
      goalService().updateGoal(user.id, {
        goalId: created.goal.id,
        priority: "HIGH",
      }),
    ).rejects.toEqual(new GoalError("GOAL_NOT_EDITABLE"));
  });

  it("keeps a completed goal immutable at the PostgreSQL boundary", async () => {
    const user = await createUser("completed-db-guard");
    const created = await goalService().createGoal(user.id, createGoalInput());
    await database.goal.update({
      where: { id: created.goal.id },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: NOW,
        archivedAt: NOW,
        actualPurchaseAmountMinor: 155_000_00n,
      },
    });

    await expect(
      database.goal.update({
        where: { id: created.goal.id },
        data: {
          status: GoalStatus.ACTIVE,
          completedAt: null,
          archivedAt: null,
          actualPurchaseAmountMinor: null,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      database.goal.update({
        where: { id: created.goal.id },
        data: { name: "Переписанная завершённая цель" },
      }),
    ).rejects.toBeDefined();

    await expect(
      database.goal.findUniqueOrThrow({ where: { id: created.goal.id } }),
    ).resolves.toMatchObject({
      status: GoalStatus.COMPLETED,
      name: created.goal.name,
      actualPurchaseAmountMinor: 155_000_00n,
    });
  });

  it("protects reads and every mutation from cross-user access", async () => {
    const owner = await createUser("owner");
    const attacker = await createUser("attacker");
    const created = await goalService().createGoal(owner.id, createGoalInput());

    await expect(
      goalService().getGoal(attacker.id, created.goal.id),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    await expect(
      goalService().updateGoal(attacker.id, {
        goalId: created.goal.id,
        name: "Р§СѓР¶Р°СЏ С†РµР»СЊ",
      }),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    await expect(
      goalService().archiveGoal(attacker.id, created.goal.id),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    await expect(
      goalService().restoreGoal(attacker.id, created.goal.id),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    expect(await goalService().listGoals(attacker.id, "ACTIVE")).toHaveLength(
      0,
    );
  });

  it("rejects deleted, already-used and cross-user image metadata", async () => {
    const owner = await createUser("image-owner");
    const attacker = await createUser("image-attacker");
    const foreignImage = await createImage(owner.id, "foreign");
    const deletedImage = await createImage(attacker.id, "deleted");
    await database.imageAsset.update({
      where: { id: deletedImage.id },
      data: { deletedAt: NOW },
    });

    await expect(
      goalService().createGoal(
        attacker.id,
        createGoalInput({ imageAssetId: foreignImage.id }),
      ),
    ).rejects.toEqual(new GoalError("IMAGE_NOT_FOUND"));
    await expect(
      goalService().createGoal(
        attacker.id,
        createGoalInput({ imageAssetId: deletedImage.id }),
      ),
    ).rejects.toEqual(new GoalError("IMAGE_NOT_FOUND"));

    const first = await goalService().createGoal(
      owner.id,
      createGoalInput({ imageAssetId: foreignImage.id }),
    );
    await expect(
      goalService().createGoal(
        owner.id,
        createGoalInput({
          name: "Р’С‚РѕСЂР°СЏ С†РµР»СЊ",
          imageAssetId: foreignImage.id,
        }),
      ),
    ).rejects.toEqual(new GoalError("IMAGE_ALREADY_USED"));
    expect(first.goal.image?.id).toBe(foreignImage.id);
  });

  it("contributes a quick amount without touching ledger balance or total capital", async () => {
    const user = await createUser("contribute");
    const account = await createAccountWithBalance(
      user.id,
      "reserve",
      100_000_00n,
    );
    const created = await goalService().createGoal(user.id, createGoalInput());
    const before = await ledgerTotal(user.id);

    const result = await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 2_000_00n,
        note: "РџРµСЂРІР°СЏ СЃРѕС‚РЅСЏ СЃ Р·Р°СЂРїР»Р°С‚С‹",
      }),
    );

    expect(result.replayed).toBe(false);
    expect(result.entryId).toBeTruthy();
    expect(result.goal).toMatchObject({
      id: created.goal.id,
      reservedAmountMinor: 2_000_00n,
      status: GoalStatus.ACTIVE,
    });

    const entry = await database.goalReservationEntry.findFirstOrThrow({
      where: { id: result.entryId },
    });
    expect(entry).toMatchObject({
      userId: user.id,
      goalId: created.goal.id,
      sourceAccountId: account.id,
      type: GoalReservationType.CONTRIBUTION,
      amountMinor: 2_000_00n,
      occurredAt: NOW,
      note: "РџРµСЂРІР°СЏ СЃРѕС‚РЅСЏ СЃ Р·Р°СЂРїР»Р°С‚С‹",
    });
    const free = await accountFreeMoney(user.id, account.id);
    expect(free).toEqual({
      balanceMinor: 100_000_00n,
      reservedMinor: 2_000_00n,
      freeMinor: 98_000_00n,
    });
    expect(await ledgerTotal(user.id)).toBe(before);
  });

  it("withdraws reserved money back into free money without touching capital", async () => {
    const user = await createUser("withdraw");
    const account = await createAccountWithBalance(
      user.id,
      "reserve",
      100_000_00n,
    );
    const created = await goalService().createGoal(user.id, createGoalInput());
    const contribute = await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        idempotencyKey: "goal-reserve-in",
      }),
    );
    const before = await ledgerTotal(user.id);

    const withdrawn = await goalService().withdrawGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 5_000_00n,
        note: "РџРµСЂРµРґСѓРјР°Р»",
        idempotencyKey: "goal-reserve-out",
      }),
    );
    expect(withdrawn.replayed).toBe(false);
    expect(withdrawn.goal.reservedAmountMinor).toBe(15_000_00n);

    const entry = await database.goalReservationEntry.findFirstOrThrow({
      where: { id: withdrawn.entryId },
    });
    expect(entry).toMatchObject({
      type: GoalReservationType.WITHDRAWAL,
      amountMinor: -5_000_00n,
      sourceAccountId: account.id,
    });
    const free = await accountFreeMoney(user.id, account.id);
    expect(free).toEqual({
      balanceMinor: 100_000_00n,
      reservedMinor: 15_000_00n,
      freeMinor: 85_000_00n,
    });
    expect(await ledgerTotal(user.id)).toBe(before);

    await expect(
      goalService().withdrawGoal(
        user.id,
        reserveInput(created.goal.id, account.id, {
          amountMinor: 20_000_00n,
          idempotencyKey: "goal-reserve-too-much",
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_GOAL_RESERVE"));
    expect(contribute.goal.reservedAmountMinor).toBe(20_000_00n);
  });

  it("refuses to reserve more than the free money of the account", async () => {
    const user = await createUser("over-reserve");
    const small = await createAccountWithBalance(user.id, "small", 10_000_00n);
    const creditEmpty = await createAccountWithBalance(
      user.id,
      "credit-empty",
      0n,
      { type: AccountType.CREDIT_CARD, creditLimitMinor: 100_000_00n },
    );
    const created = await goalService().createGoal(user.id, createGoalInput());

    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, small.id, {
          amountMinor: 10_000_01n,
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE"));
    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, creditEmpty.id, {
          amountMinor: 1_00n,
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE"));
    expect(await database.goalReservationEntry.count()).toBe(0);
    expect(created.goal.reservedAmountMinor).toBe(0n);
  });

  it("refuses to reserve from an archived account or an archived/completed goal", async () => {
    const user = await createUser("inactive");
    const account = await createAccountWithBalance(
      user.id,
      "archived",
      100_000_00n,
    );
    await database.account.update({
      where: { id: account.id },
      data: { archivedAt: NOW },
    });
    const created = await goalService().createGoal(user.id, createGoalInput());

    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, account.id),
      ),
    ).rejects.toEqual(new GoalError("ACCOUNT_ARCHIVED"));

    const archived = await goalService().archiveGoal(user.id, created.goal.id);
    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(archived.id, account.id),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_ACTIVE"));

    const completed = await goalService().createGoal(
      user.id,
      createGoalInput({ name: "Р—Р°РІРµСЂС€С‘РЅРЅР°СЏ" }),
    );
    await database.goal.update({
      where: { id: completed.goal.id },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: NOW,
        archivedAt: NOW,
        actualPurchaseAmountMinor: 1_00n,
      },
    });
    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(completed.goal.id, account.id),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_ACTIVE"));
  });

  it("replays a duplicate reserve mutation and rejects a conflicting payload", async () => {
    const user = await createUser("duplicate");
    const account = await createAccountWithBalance(user.id, "dup", 100_000_00n);
    const created = await goalService().createGoal(user.id, createGoalInput());
    const input = reserveInput(created.goal.id, account.id, {
      idempotencyKey: "goal-reserve-stable",
    });

    const first = await goalService().contributeGoal(user.id, input);
    const replayed = await goalService().contributeGoal(user.id, input);
    expect(replayed).toMatchObject({
      replayed: true,
      entryId: first.entryId,
      goal: { id: created.goal.id, reservedAmountMinor: 20_000_00n },
    });
    expect(await database.goalReservationEntry.count()).toBe(1);

    await expect(
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, account.id, {
          idempotencyKey: "goal-reserve-stable",
          amountMinor: 5_000_00n,
        }),
      ),
    ).rejects.toEqual(new GoalError("IDEMPOTENCY_CONFLICT"));
    expect(await database.goalReservationEntry.count()).toBe(1);
  });

  it("keeps total capital invariant across initial, contribution and withdrawal", async () => {
    const user = await createUser("invariance");
    const first = await createAccountWithBalance(user.id, "inv-a", 60_000_00n);
    const second = await createAccountWithBalance(user.id, "inv-b", 40_000_00n);
    const before = await ledgerTotal(user.id);
    expect(before).toBe(100_000_00n);

    const created = await goalService().createGoal(
      user.id,
      createGoalInput({
        initialReservation: {
          sourceAccountId: first.id,
          amountMinor: 10_000_00n,
          occurredAt: NOW.toISOString(),
        },
      }),
    );
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, second.id, {
        amountMinor: 5_000_00n,
        idempotencyKey: "goal-reserve-inv-a",
      }),
    );
    await goalService().withdrawGoal(
      user.id,
      reserveInput(created.goal.id, first.id, {
        amountMinor: 3_000_00n,
        idempotencyKey: "goal-reserve-inv-b",
      }),
    );

    expect(await ledgerTotal(user.id)).toBe(before);
    expect(
      await database.financialOperation.count({ where: { userId: user.id } }),
    ).toBe(2);
    const goal = await goalService().getGoal(user.id, created.goal.id);
    expect(goal.reservedAmountMinor).toBe(12_000_00n);
    const [firstState, secondState] = await Promise.all([
      accountFreeMoney(user.id, first.id),
      accountFreeMoney(user.id, second.id),
    ]);
    expect(firstState.reservedMinor).toBe(7_000_00n);
    expect(secondState.reservedMinor).toBe(5_000_00n);
  });

  it("serializes a concurrent double tap into one entry and applies competing reservations fully", async () => {
    const user = await createUser("concurrent");
    const account = await createAccountWithBalance(
      user.id,
      "race",
      100_000_00n,
    );
    const created = await goalService().createGoal(user.id, createGoalInput());
    const input = reserveInput(created.goal.id, account.id, {
      idempotencyKey: "goal-reserve-race",
    });

    const [a, b] = await Promise.all([
      goalService().contributeGoal(user.id, input),
      goalService().contributeGoal(user.id, input),
    ]);
    expect(a.goal.reservedAmountMinor).toBe(20_000_00n);
    expect(b.goal.reservedAmountMinor).toBe(20_000_00n);
    expect(await database.goalReservationEntry.count()).toBe(1);

    const [c, d] = await Promise.all([
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, account.id, {
          amountMinor: 10_000_00n,
          idempotencyKey: "goal-reserve-race-a",
        }),
      ),
      goalService().contributeGoal(
        user.id,
        reserveInput(created.goal.id, account.id, {
          amountMinor: 30_000_00n,
          idempotencyKey: "goal-reserve-race-b",
        }),
      ),
    ]);
    expect(c.goal.reservedAmountMinor).toBeLessThanOrEqual(60_000_00n);
    expect(d.goal.reservedAmountMinor).toBeLessThanOrEqual(60_000_00n);
    expect(await database.goalReservationEntry.count()).toBe(3);
    const final = await goalService().getGoal(user.id, created.goal.id);
    expect(final.reservedAmountMinor).toBe(60_000_00n);
    const free = await accountFreeMoney(user.id, account.id);
    expect(free.reservedMinor).toBe(60_000_00n);
  });

  it("rejects cross-user goal and account in reserve mutations like missing rows", async () => {
    const owner = await createUser("reserve-owner");
    const attacker = await createUser("reserve-attacker");
    const ownerAccount = await createAccountWithBalance(
      owner.id,
      "owner",
      100_000_00n,
    );
    const attackerAccount = await createAccountWithBalance(
      attacker.id,
      "attacker",
      100_000_00n,
    );
    const created = await goalService().createGoal(owner.id, createGoalInput());

    await expect(
      goalService().contributeGoal(
        attacker.id,
        reserveInput(created.goal.id, attackerAccount.id),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    await expect(
      goalService().contributeGoal(
        owner.id,
        reserveInput(created.goal.id, attackerAccount.id),
      ),
    ).rejects.toEqual(new GoalError("ACCOUNT_NOT_FOUND"));
    await expect(
      goalService().withdrawGoal(
        attacker.id,
        reserveInput(created.goal.id, ownerAccount.id),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    expect(await database.goalReservationEntry.count()).toBe(0);
  });

  it("completes a goal below the reserved amount with one purchase expense and a full release", async () => {
    const user = await createUser("complete-below");
    const events: GoalDomainEvent[] = [];
    const service = goalService((event) => events.push(event));
    const account = await createAccountWithBalance(
      user.id,
      "below",
      200_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await service.contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-below-reserve",
      }),
    );

    const result = await service.completeGoal(
      user.id,
      completeInput(created.goal.id, account.id, {
        actualPurchaseAmountMinor: 90_000_00n,
        idempotencyKey: "goal-complete-below",
      }),
    );

    expect(result.replayed).toBe(false);
    expect(result.goal).toMatchObject({
      id: created.goal.id,
      status: GoalStatus.COMPLETED,
      actualPurchaseAmountMinor: 90_000_00n,
      completedAt: NOW,
      archivedAt: NOW,
      reservedAmountMinor: 0n,
    });
    expect(result.purchaseOperationId).toBeTruthy();
    expect(await ledgerTotal(user.id)).toBe(before - 90_000_00n);

    const purchases = await database.financialOperation.findMany({
      where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
    });
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({
      goalId: created.goal.id,
      note: "РљСѓРїР»РµРЅРѕ",
      occurredAt: NOW,
    });
    const entries = await database.ledgerEntry.findMany({
      where: { operationId: purchases[0]?.id ?? "" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      accountId: account.id,
      amountMinor: -90_000_00n,
      role: LedgerEntryRole.PRIMARY,
    });
    expect(
      await database.goalReservationEntry.findMany({
        where: { goalId: created.goal.id },
        orderBy: { createdAt: "asc" },
        select: { type: true, amountMinor: true, sourceAccountId: true },
      }),
    ).toEqual([
      {
        type: GoalReservationType.CONTRIBUTION,
        amountMinor: 100_000_00n,
        sourceAccountId: account.id,
      },
      {
        type: GoalReservationType.RELEASE_ON_COMPLETION,
        amountMinor: -100_000_00n,
        sourceAccountId: account.id,
      },
    ]);
    const free = await accountFreeMoney(user.id, account.id);
    expect(free).toEqual({
      balanceMinor: 110_000_00n,
      reservedMinor: 0n,
      freeMinor: 110_000_00n,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "goal.completed",
      version: 1,
      data: {
        goalId: created.goal.id,
        userId: user.id,
        name: "MacBook",
        category: GoalCategory.TECH,
        targetAmountMinor: 160_000_00n,
        actualPurchaseAmountMinor: 90_000_00n,
        releasedReserveAmountMinor: 100_000_00n,
        purchaseOperationId: result.purchaseOperationId,
      },
    });
    expect(events[0]?.occurredAt).toBeInstanceOf(Date);
    expect(typeof events[0]?.id).toBe("string");
  });

  it("completes a goal exactly at the reserved amount", async () => {
    const user = await createUser("complete-equal");
    const account = await createAccountWithBalance(
      user.id,
      "equal",
      100_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-equal-reserve",
      }),
    );

    const result = await goalService().completeGoal(
      user.id,
      completeInput(created.goal.id, account.id, {
        actualPurchaseAmountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-equal",
      }),
    );

    expect(result.goal.reservedAmountMinor).toBe(0n);
    expect(await ledgerTotal(user.id)).toBe(before - 100_000_00n);
    const free = await accountFreeMoney(user.id, account.id);
    expect(free).toEqual({
      balanceMinor: 0n,
      reservedMinor: 0n,
      freeMinor: 0n,
    });
    expect(
      await database.financialOperation.count({
        where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(1);
  });

  it("completes a goal at the target amount and above the reserved amount", async () => {
    const user = await createUser("complete-target");
    const account = await createAccountWithBalance(
      user.id,
      "target",
      200_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-target-reserve",
      }),
    );

    const result = await goalService().completeGoal(
      user.id,
      completeInput(created.goal.id, account.id, {
        actualPurchaseAmountMinor: 160_000_00n,
        idempotencyKey: "goal-complete-target",
      }),
    );

    expect(result.goal).toMatchObject({
      status: GoalStatus.COMPLETED,
      actualPurchaseAmountMinor: 160_000_00n,
    });
    expect(await ledgerTotal(user.id)).toBe(before - 160_000_00n);
    const free = await accountFreeMoney(user.id, account.id);
    expect(free).toEqual({
      balanceMinor: 40_000_00n,
      reservedMinor: 0n,
      freeMinor: 40_000_00n,
    });
  });

  it("completes a goal above the target when free money covers the difference", async () => {
    const user = await createUser("complete-above");
    const account = await createAccountWithBalance(
      user.id,
      "above",
      250_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-above-reserve",
      }),
    );

    const result = await goalService().completeGoal(
      user.id,
      completeInput(created.goal.id, account.id, {
        actualPurchaseAmountMinor: 170_000_00n,
        idempotencyKey: "goal-complete-above",
      }),
    );

    expect(result.goal).toMatchObject({
      status: GoalStatus.COMPLETED,
      actualPurchaseAmountMinor: 170_000_00n,
      reservedAmountMinor: 0n,
    });
    expect(await ledgerTotal(user.id)).toBe(before - 170_000_00n);
    const free = await accountFreeMoney(user.id, account.id);
    expect(free.freeMinor).toBe(80_000_00n);
    expect(free.reservedMinor).toBe(0n);
  });

  it("refuses completion when the payment account cannot cover the purchase after the release", async () => {
    const user = await createUser("complete-insufficient");
    const poor = await createAccountWithBalance(user.id, "poor", 120_000_00n);
    const rich = await createAccountWithBalance(user.id, "rich", 100_000_00n);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, poor.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-insufficient-reserve",
      }),
    );

    await expect(
      goalService().completeGoal(
        user.id,
        completeInput(created.goal.id, poor.id, {
          actualPurchaseAmountMinor: 150_000_00n,
          idempotencyKey: "goal-complete-insufficient",
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE"));

    const untouched = await goalService().getGoal(user.id, created.goal.id);
    expect(untouched).toMatchObject({
      status: GoalStatus.ACTIVE,
      reservedAmountMinor: 100_000_00n,
    });
    expect(
      await database.financialOperation.count({
        where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(0);
    expect(await accountFreeMoney(user.id, poor.id)).toMatchObject({
      balanceMinor: 120_000_00n,
      reservedMinor: 100_000_00n,
      freeMinor: 20_000_00n,
    });
    expect(await ledgerTotal(user.id)).toBe(220_000_00n);

    await expect(
      goalService().completeGoal(
        user.id,
        completeInput(created.goal.id, rich.id, {
          actualPurchaseAmountMinor: 150_000_00n,
          idempotencyKey: "goal-complete-insufficient-foreign-reserve",
        }),
      ),
    ).rejects.toEqual(new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE"));
    expect(
      await database.goalReservationEntry.count({
        where: {
          goalId: created.goal.id,
          type: GoalReservationType.RELEASE_ON_COMPLETION,
        },
      }),
    ).toBe(0);
  });

  it("replays a duplicate completion without a second charge and rejects conflicting payload", async () => {
    const user = await createUser("complete-duplicate");
    const account = await createAccountWithBalance(user.id, "dup", 200_000_00n);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-dup-reserve",
      }),
    );
    const input = completeInput(created.goal.id, account.id, {
      actualPurchaseAmountMinor: 90_000_00n,
      idempotencyKey: "goal-complete-stable",
    });

    const first = await goalService().completeGoal(user.id, input);
    const ledgerAfterFirst = await ledgerTotal(user.id);
    const replayed = await goalService().completeGoal(user.id, input);

    expect(replayed).toMatchObject({
      replayed: true,
      purchaseOperationId: first.purchaseOperationId,
      goal: {
        id: created.goal.id,
        status: GoalStatus.COMPLETED,
        actualPurchaseAmountMinor: 90_000_00n,
      },
    });
    expect(await ledgerTotal(user.id)).toBe(ledgerAfterFirst);
    expect(
      await database.financialOperation.count({
        where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(1);
    expect(
      await database.goalReservationEntry.count({
        where: {
          goalId: created.goal.id,
          type: GoalReservationType.RELEASE_ON_COMPLETION,
        },
      }),
    ).toBe(1);
    expect(
      await database.idempotencyKey.count({
        where: { userId: user.id, scope: "goal.complete" },
      }),
    ).toBe(1);

    await expect(
      goalService().completeGoal(user.id, {
        ...input,
        actualPurchaseAmountMinor: 50_000_00n,
      }),
    ).rejects.toEqual(new GoalError("IDEMPOTENCY_CONFLICT"));
    expect(
      await database.financialOperation.count({
        where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(1);
  });

  it("serializes a concurrent completion into exactly one purchase expense", async () => {
    const user = await createUser("complete-concurrent");
    const account = await createAccountWithBalance(
      user.id,
      "race",
      200_000_00n,
    );
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-race-reserve",
      }),
    );
    const input = completeInput(created.goal.id, account.id, {
      actualPurchaseAmountMinor: 90_000_00n,
      idempotencyKey: "goal-complete-race",
    });

    const [a, b] = await Promise.all([
      goalService().completeGoal(user.id, input),
      goalService().completeGoal(user.id, input),
    ]);
    expect(a.goal.status).toBe(GoalStatus.COMPLETED);
    expect(b.goal.status).toBe(GoalStatus.COMPLETED);
    expect(
      await database.financialOperation.count({
        where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(1);
    expect(
      await database.goalReservationEntry.count({
        where: {
          goalId: created.goal.id,
          type: GoalReservationType.RELEASE_ON_COMPLETION,
        },
      }),
    ).toBe(1);
    const final = await goalService().getGoal(user.id, created.goal.id);
    expect(final.reservedAmountMinor).toBe(0n);
    expect((await accountFreeMoney(user.id, account.id)).freeMinor).toBe(
      110_000_00n,
    );
  });

  it("rejects cross-user goal and payment account in completion like missing rows", async () => {
    const owner = await createUser("complete-owner");
    const attacker = await createUser("complete-attacker");
    const ownerAccount = await createAccountWithBalance(
      owner.id,
      "owner",
      200_000_00n,
    );
    const attackerAccount = await createAccountWithBalance(
      attacker.id,
      "attacker",
      200_000_00n,
    );
    const created = await goalService().createGoal(owner.id, createGoalInput());
    await goalService().contributeGoal(
      owner.id,
      reserveInput(created.goal.id, ownerAccount.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-cross-reserve",
      }),
    );

    await expect(
      goalService().completeGoal(
        attacker.id,
        completeInput(created.goal.id, attackerAccount.id, {
          idempotencyKey: "goal-complete-cross-goal",
        }),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_FOUND"));
    await expect(
      goalService().completeGoal(
        owner.id,
        completeInput(created.goal.id, attackerAccount.id, {
          idempotencyKey: "goal-complete-cross-account",
        }),
      ),
    ).rejects.toEqual(new GoalError("ACCOUNT_NOT_FOUND"));
    expect(
      await database.financialOperation.count({
        where: { userId: owner.id, type: OperationType.GOAL_PURCHASE },
      }),
    ).toBe(0);
    expect(
      (await goalService().getGoal(owner.id, created.goal.id)).status,
    ).toBe(GoalStatus.ACTIVE);
  });

  it("rejects archived accounts and non-active goals in completion", async () => {
    const user = await createUser("complete-inactive");
    const account = await createAccountWithBalance(
      user.id,
      "inactive",
      200_000_00n,
    );
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, account.id, {
        amountMinor: 100_000_00n,
        idempotencyKey: "goal-complete-inactive-reserve",
      }),
    );

    await database.account.update({
      where: { id: account.id },
      data: { archivedAt: NOW },
    });
    await expect(
      goalService().completeGoal(
        user.id,
        completeInput(created.goal.id, account.id, {
          idempotencyKey: "goal-complete-archived-account",
        }),
      ),
    ).rejects.toEqual(new GoalError("ACCOUNT_ARCHIVED"));

    await database.account.update({
      where: { id: account.id },
      data: { archivedAt: null },
    });
    const archived = await goalService().archiveGoal(
      user.id,
      (
        await goalService().createGoal(
          user.id,
          createGoalInput({ name: "РђСЂС…РёРІРЅР°СЏ" }),
        )
      ).goal.id,
    );
    await expect(
      goalService().completeGoal(
        user.id,
        completeInput(archived.id, account.id, {
          idempotencyKey: "goal-complete-archived-goal",
        }),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_ACTIVE"));

    const completed = await goalService().createGoal(
      user.id,
      createGoalInput({ name: "РЈР¶Рµ Р·Р°РІРµСЂС€С‘РЅРЅР°СЏ" }),
    );
    await database.goal.update({
      where: { id: completed.goal.id },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: NOW,
        archivedAt: NOW,
        actualPurchaseAmountMinor: 1_00n,
      },
    });
    await expect(
      goalService().completeGoal(
        user.id,
        completeInput(completed.goal.id, account.id, {
          idempotencyKey: "goal-complete-completed-goal",
        }),
      ),
    ).rejects.toEqual(new GoalError("GOAL_NOT_ACTIVE"));
  });

  it("releases reserve from every source account but posts the single expense on the payment account", async () => {
    const user = await createUser("complete-multi");
    const first = await createAccountWithBalance(
      user.id,
      "multi-a",
      100_000_00n,
    );
    const second = await createAccountWithBalance(
      user.id,
      "multi-b",
      100_000_00n,
    );
    const before = await ledgerTotal(user.id);
    const created = await goalService().createGoal(user.id, createGoalInput());
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, first.id, {
        amountMinor: 60_000_00n,
        idempotencyKey: "goal-complete-multi-a",
      }),
    );
    await goalService().contributeGoal(
      user.id,
      reserveInput(created.goal.id, second.id, {
        amountMinor: 40_000_00n,
        idempotencyKey: "goal-complete-multi-b",
      }),
    );

    const result = await goalService().completeGoal(
      user.id,
      completeInput(created.goal.id, second.id, {
        actualPurchaseAmountMinor: 40_000_00n,
        idempotencyKey: "goal-complete-multi",
      }),
    );

    expect(result.goal.reservedAmountMinor).toBe(0n);
    expect(await ledgerTotal(user.id)).toBe(before - 40_000_00n);
    const releases = await database.goalReservationEntry.findMany({
      where: {
        goalId: created.goal.id,
        type: GoalReservationType.RELEASE_ON_COMPLETION,
      },
      select: { sourceAccountId: true, amountMinor: true },
    });
    const expectedReleases = new Map([
      [first.id, -60_000_00n],
      [second.id, -40_000_00n],
    ]);
    expect(releases).toHaveLength(2);
    expect(releases).toEqual(
      expect.arrayContaining(
        [first, second].map((account) => ({
          sourceAccountId: account.id,
          amountMinor: expectedReleases.get(account.id),
        })),
      ),
    );
    const purchases = await database.financialOperation.findMany({
      where: { userId: user.id, type: OperationType.GOAL_PURCHASE },
      include: { ledgerEntries: true },
    });
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.ledgerEntries).toHaveLength(1);
    expect(purchases[0]?.ledgerEntries[0]).toMatchObject({
      accountId: second.id,
      amountMinor: -40_000_00n,
    });
    const firstState = await accountFreeMoney(user.id, first.id);
    const secondState = await accountFreeMoney(user.id, second.id);
    expect(firstState).toMatchObject({
      balanceMinor: 100_000_00n,
      reservedMinor: 0n,
    });
    expect(secondState).toMatchObject({
      balanceMinor: 60_000_00n,
      reservedMinor: 0n,
    });
  });
});

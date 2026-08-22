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
  CategoryKind,
  Currency,
  type PrismaClient,
} from "@/generated/prisma/client";
import { CategoryError } from "@/server/categories/errors";
import {
  createCategoryService,
  type CreateCategoryInput,
} from "@/server/categories/service";
import {
  createCategoryTestClient,
  prepareCategoryTestDatabase,
} from "./category-test-database";

const NOW = new Date("2026-08-10T10:00:00.000Z");
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

function categoryService() {
  return createCategoryService({ database, now: () => new Date(NOW) });
}

function createCategoryInput(
  overrides: Partial<CreateCategoryInput> = {},
): CreateCategoryInput {
  return {
    kind: CategoryKind.EXPENSE,
    labelRu: "Хобби",
    iconName: "savings",
    ...overrides,
  };
}

beforeAll(async () => {
  await prepareCategoryTestDatabase();
  database = createCategoryTestClient();
});

beforeEach(async () => {
  await database.idempotencyKey.deleteMany();
  await database.category.deleteMany();
  await database.notificationPreference.deleteMany();
  await database.onboardingState.deleteMany();
  await database.userSettings.deleteMany();
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("server-only category domain", () => {
  it("materializes the system catalog for a fresh user without any seed", async () => {
    const user = await createUser("fresh");
    const income = await categoryService().listCategories(user.id, "INCOME");
    const expense = await categoryService().listCategories(user.id, "EXPENSE");

    expect(income).toHaveLength(7);
    expect(expense).toHaveLength(13);
    expect(income.map((category) => category.slug)).toEqual([
      "salary",
      "side-job",
      "gift",
      "sale",
      "refund",
      "bonus",
      "other-income",
    ]);
    expect(expense.map((category) => category.slug)).toEqual([
      "groceries",
      "transport",
      "cafe",
      "housing",
      "subscriptions",
      "entertainment",
      "clothes",
      "health",
      "education",
      "tech",
      "gifts",
      "travel",
      "other-expense",
    ]);
    for (const category of [...income, ...expense]) {
      expect(category.system).toBe(true);
      expect(category.archivedAt).toBeNull();
    }
    expect(
      await database.category.count({ where: { ownerUserId: null } }),
    ).toBe(20);
  });

  it("is idempotent for repeated and concurrent ensure calls", async () => {
    const service = categoryService();
    await service.ensureSystemCategories(database);
    await service.ensureSystemCategories(database);
    await Promise.all([
      service.ensureSystemCategories(database),
      service.ensureSystemCategories(database),
    ]);

    expect(
      await database.category.count({ where: { ownerUserId: null } }),
    ).toBe(20);
    const slugs = await database.category.findMany({
      where: { ownerUserId: null },
      select: { slug: true },
    });
    expect(new Set(slugs.map((row) => row.slug)).size).toBe(20);
  });

  it("repairs a partial or drifted system catalog instead of trusting its row count", async () => {
    const user = await createUser("catalog-repair");
    const service = categoryService();
    await service.ensureSystemCategories(database);

    await database.category.deleteMany({
      where: { ownerUserId: null, kind: CategoryKind.INCOME, slug: "salary" },
    });
    await database.category.create({
      data: {
        kind: CategoryKind.INCOME,
        slug: "obsolete-income",
        labelRu: "Устаревшая",
        iconName: "income-other",
        sortOrder: 5,
      },
    });
    await database.category.updateMany({
      where: {
        ownerUserId: null,
        kind: CategoryKind.EXPENSE,
        slug: "groceries",
      },
      data: {
        labelRu: "Повреждённое название",
        iconName: "expense-other",
        sortOrder: 999,
        archivedAt: NOW,
      },
    });

    const income = await service.listCategories(user.id, "INCOME");
    const expense = await service.listCategories(user.id, "EXPENSE");

    expect(income.map((category) => category.slug)).toEqual([
      "salary",
      "side-job",
      "gift",
      "sale",
      "refund",
      "bonus",
      "other-income",
    ]);
    expect(expense).toContainEqual(
      expect.objectContaining({
        slug: "groceries",
        labelRu: "Продукты",
        iconName: "expense-groceries",
        sortOrder: 10,
        archivedAt: null,
      }),
    );
  });

  it("keeps income and expense listings separated by kind", async () => {
    const user = await createUser("kinds");
    const income = await categoryService().listCategories(user.id, "INCOME");
    const expense = await categoryService().listCategories(user.id, "EXPENSE");

    expect(
      income.every((category) => category.kind === CategoryKind.INCOME),
    ).toBe(true);
    expect(
      expense.every((category) => category.kind === CategoryKind.EXPENSE),
    ).toBe(true);
    await expect(
      categoryService().listCategories(user.id, "expense"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("creates user categories visible only to their owner with a stable custom slug", async () => {
    const owner = await createUser("owner");
    const service = categoryService();

    const created = await service.createCategory(
      owner.id,
      createCategoryInput(),
    );
    const stranger = await createUser("stranger");

    expect(created.system).toBe(false);
    expect(created.kind).toBe(CategoryKind.EXPENSE);
    expect(created.slug).toMatch(/^custom-[0-9a-f]{32}$/u);
    expect(created.sortOrder).toBe(1000);

    const ownerExpense = await service.listCategories(owner.id, "EXPENSE");
    expect(ownerExpense).toContainEqual(
      expect.objectContaining({ id: created.id }),
    );
    const strangerExpense = await service.listCategories(
      stranger.id,
      "EXPENSE",
    );
    expect(strangerExpense.some((category) => category.id === created.id)).toBe(
      false,
    );
    const ownerIncome = await service.listCategories(owner.id, "INCOME");
    expect(ownerIncome.some((category) => category.id === created.id)).toBe(
      false,
    );
  });

  it("rejects invalid custom category input without creating rows", async () => {
    const user = await createUser("invalid");
    const inputs: CreateCategoryInput[] = [
      createCategoryInput({ labelRu: "   " }),
      {
        kind: "UNKNOWN" as CreateCategoryInput["kind"],
        labelRu: "Хобби",
        iconName: "savings",
      },
      {
        kind: "EXPENSE",
        labelRu: "Хобби",
        iconName: "expense-groceries" as CreateCategoryInput["iconName"],
      },
      createCategoryInput({ labelRu: "а".repeat(81) }),
    ];

    for (const input of inputs) {
      await expect(
        categoryService().createCategory(user.id, input),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(
      await database.category.count({ where: { ownerUserId: user.id } }),
    ).toBe(0);
  });

  it("refuses an expense category for income operations, and vice versa", async () => {
    const user = await createUser("kind-guard");
    const service = categoryService();
    await service.ensureSystemCategories(database);
    const categories = await database.category.findMany({
      where: { ownerUserId: null },
    });
    const incomeCategory = categories.find(
      (category) => category.kind === CategoryKind.INCOME,
    );
    const expenseCategory = categories.find(
      (category) => category.kind === CategoryKind.EXPENSE,
    );

    await expect(
      service.resolveOperationCategory(
        database,
        user.id,
        "INCOME",
        expenseCategory?.id,
      ),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(
      service.resolveOperationCategory(
        database,
        user.id,
        "EXPENSE",
        incomeCategory?.id,
      ),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(
      service.resolveOperationCategory(
        database,
        user.id,
        "EXPENSE",
        expenseCategory?.id,
      ),
    ).resolves.toMatchObject({ id: expenseCategory?.id });
    const custom = await service.createCategory(user.id, createCategoryInput());
    await expect(
      service.resolveOperationCategory(database, user.id, "INCOME", custom.id),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(
      service.resolveOperationCategory(database, user.id, "EXPENSE", custom.id),
    ).resolves.toMatchObject({ id: custom.id });
  });

  it("protects user categories across users and treats system categories as read-only", async () => {
    const owner = await createUser("security-owner");
    const attacker = await createUser("security-attacker");
    const service = categoryService();
    await service.ensureSystemCategories(database);
    const custom = await service.createCategory(
      owner.id,
      createCategoryInput(),
    );
    const system = await database.category.findFirstOrThrow({
      where: { ownerUserId: null },
    });

    await expect(
      service.resolveOperationCategory(
        database,
        attacker.id,
        "EXPENSE",
        custom.id,
      ),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(
      service.archiveCategory(attacker.id, custom.id),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(
      service.archiveCategory(attacker.id, randomUUID()),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
    await expect(service.archiveCategory(owner.id, system.id)).rejects.toEqual(
      new CategoryError("CATEGORY_NOT_FOUND"),
    );

    const archived = await service.archiveCategory(owner.id, custom.id);
    expect(archived.archivedAt).toEqual(NOW);
    const ownerExpense = await service.listCategories(owner.id, "EXPENSE");
    expect(ownerExpense.some((category) => category.id === custom.id)).toBe(
      false,
    );
    await expect(
      service.resolveOperationCategory(
        database,
        owner.id,
        "EXPENSE",
        custom.id,
      ),
    ).rejects.toEqual(new CategoryError("CATEGORY_NOT_FOUND"));
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CORE_ICON_NAMES,
  EXPENSE_ICON_NAMES,
  INCOME_ICON_NAMES,
} from "@/components/icons/icon-names";
import {
  CATEGORY_KINDS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_SLUGS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_SLUGS,
  SYSTEM_CATEGORIES,
} from "@/lib/categories/catalog";
import {
  CUSTOM_CATEGORY_ICONS,
  categoryKindSchema,
  createCategoryInputSchema,
} from "@/server/categories/validation";

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

describe("system category catalog", () => {
  it("defines the income catalog in the master prompt order", () => {
    expect(INCOME_CATEGORIES.map((entry) => entry.slug)).toEqual([
      "salary",
      "side-job",
      "gift",
      "sale",
      "refund",
      "bonus",
      "other-income",
    ]);
    expect(INCOME_CATEGORIES.map((entry) => entry.labelRu)).toEqual([
      "Зарплата",
      "Подработка",
      "Подарок",
      "Продажа",
      "Возврат",
      "Бонус",
      "Другое",
    ]);
  });

  it("defines the expense catalog in the master prompt order", () => {
    expect(EXPENSE_CATEGORIES.map((entry) => entry.slug)).toEqual([
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
    expect(EXPENSE_CATEGORIES.map((entry) => entry.labelRu)).toEqual([
      "Продукты",
      "Транспорт",
      "Кафе",
      "Жильё",
      "Подписки",
      "Развлечения",
      "Одежда",
      "Здоровье",
      "Образование",
      "Техника",
      "Подарки",
      "Путешествия",
      "Другое",
    ]);
  });

  it("keeps kinds, slug unions and icon names in sync with the catalog", () => {
    expect(CATEGORY_KINDS).toEqual(["INCOME", "EXPENSE"]);
    expect(INCOME_CATEGORY_SLUGS).toEqual(
      INCOME_CATEGORIES.map((entry) => entry.slug),
    );
    expect(EXPENSE_CATEGORY_SLUGS).toEqual(
      EXPENSE_CATEGORIES.map((entry) => entry.slug),
    );
    for (const entry of INCOME_CATEGORIES) {
      expect(INCOME_ICON_NAMES).toContain(entry.iconName);
    }
    for (const entry of EXPENSE_CATEGORIES) {
      expect(EXPENSE_ICON_NAMES).toContain(entry.iconName);
    }
  });

  it("uses stable slugs, unique per kind, with unique sort orders", () => {
    expect(SYSTEM_CATEGORIES).toHaveLength(20);
    const slugs = SYSTEM_CATEGORIES.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const entry of SYSTEM_CATEGORIES) {
      expect(entry.slug, entry.slug).toMatch(CATEGORY_SLUG_PATTERN);
    }
    for (const entries of [INCOME_CATEGORIES, EXPENSE_CATEGORIES]) {
      const orders = entries.map((entry) => entry.sortOrder);
      expect(new Set(orders).size).toBe(orders.length);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    }
  });

  it("allows only kind-neutral core icons for custom categories", () => {
    expect(CUSTOM_CATEGORY_ICONS.length).toBeGreaterThan(0);
    for (const iconName of CUSTOM_CATEGORY_ICONS) {
      expect(CORE_ICON_NAMES).toContain(iconName);
      expect([...INCOME_ICON_NAMES, ...EXPENSE_ICON_NAMES]).not.toContain(
        iconName,
      );
    }
  });

  it("validates category creation input with a kind-agnostic icon set", () => {
    expect(categoryKindSchema.parse("INCOME")).toBe("INCOME");
    expect(categoryKindSchema.safeParse("EXPENSE").success).toBe(true);
    expect(categoryKindSchema.safeParse("expense").success).toBe(false);

    const valid = createCategoryInputSchema.safeParse({
      kind: "EXPENSE",
      labelRu: "Хобби",
      iconName: "savings",
    });
    expect(valid.success).toBe(true);

    for (const input of [
      { kind: "EXPENSE", labelRu: "Хобби", iconName: "expense-groceries" },
      { kind: "INCOME", labelRu: "", iconName: "cash" },
      { kind: "UNKNOWN", labelRu: "Хобби", iconName: "cash" },
      { kind: "EXPENSE", labelRu: "Хобби", iconName: "savings", extra: true },
    ]) {
      expect(createCategoryInputSchema.safeParse(input).success).toBe(false);
    }
  });
});

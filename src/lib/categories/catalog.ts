import type {
  ExpenseIconName,
  IncomeIconName,
} from "@/components/icons/icon-names";

export const CATEGORY_KINDS = ["INCOME", "EXPENSE"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const INCOME_CATEGORY_SLUGS = [
  "salary",
  "side-job",
  "gift",
  "sale",
  "refund",
  "bonus",
  "other-income",
] as const;
export type IncomeCategorySlug = (typeof INCOME_CATEGORY_SLUGS)[number];

export const EXPENSE_CATEGORY_SLUGS = [
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
] as const;
export type ExpenseCategorySlug = (typeof EXPENSE_CATEGORY_SLUGS)[number];

interface IncomeCategoryEntry {
  kind: "INCOME";
  slug: IncomeCategorySlug;
  labelRu: string;
  iconName: IncomeIconName;
  sortOrder: number;
}

interface ExpenseCategoryEntry {
  kind: "EXPENSE";
  slug: ExpenseCategorySlug;
  labelRu: string;
  iconName: ExpenseIconName;
  sortOrder: number;
}

export type SystemCategoryEntry = IncomeCategoryEntry | ExpenseCategoryEntry;

export const INCOME_CATEGORIES = [
  {
    kind: "INCOME",
    slug: "salary",
    labelRu: "Зарплата",
    iconName: "income-salary",
    sortOrder: 10,
  },
  {
    kind: "INCOME",
    slug: "side-job",
    labelRu: "Подработка",
    iconName: "income-side-job",
    sortOrder: 20,
  },
  {
    kind: "INCOME",
    slug: "gift",
    labelRu: "Подарок",
    iconName: "income-gift",
    sortOrder: 30,
  },
  {
    kind: "INCOME",
    slug: "sale",
    labelRu: "Продажа",
    iconName: "income-sale",
    sortOrder: 40,
  },
  {
    kind: "INCOME",
    slug: "refund",
    labelRu: "Возврат",
    iconName: "income-refund",
    sortOrder: 50,
  },
  {
    kind: "INCOME",
    slug: "bonus",
    labelRu: "Бонус",
    iconName: "income-bonus",
    sortOrder: 60,
  },
  {
    kind: "INCOME",
    slug: "other-income",
    labelRu: "Другое",
    iconName: "income-other",
    sortOrder: 70,
  },
] as const satisfies readonly IncomeCategoryEntry[];

export const EXPENSE_CATEGORIES = [
  {
    kind: "EXPENSE",
    slug: "groceries",
    labelRu: "Продукты",
    iconName: "expense-groceries",
    sortOrder: 10,
  },
  {
    kind: "EXPENSE",
    slug: "transport",
    labelRu: "Транспорт",
    iconName: "expense-transport",
    sortOrder: 20,
  },
  {
    kind: "EXPENSE",
    slug: "cafe",
    labelRu: "Кафе",
    iconName: "expense-cafe",
    sortOrder: 30,
  },
  {
    kind: "EXPENSE",
    slug: "housing",
    labelRu: "Жильё",
    iconName: "expense-housing",
    sortOrder: 40,
  },
  {
    kind: "EXPENSE",
    slug: "subscriptions",
    labelRu: "Подписки",
    iconName: "expense-subscriptions",
    sortOrder: 50,
  },
  {
    kind: "EXPENSE",
    slug: "entertainment",
    labelRu: "Развлечения",
    iconName: "expense-entertainment",
    sortOrder: 60,
  },
  {
    kind: "EXPENSE",
    slug: "clothes",
    labelRu: "Одежда",
    iconName: "expense-clothes",
    sortOrder: 70,
  },
  {
    kind: "EXPENSE",
    slug: "health",
    labelRu: "Здоровье",
    iconName: "expense-health",
    sortOrder: 80,
  },
  {
    kind: "EXPENSE",
    slug: "education",
    labelRu: "Образование",
    iconName: "expense-education",
    sortOrder: 90,
  },
  {
    kind: "EXPENSE",
    slug: "tech",
    labelRu: "Техника",
    iconName: "expense-tech",
    sortOrder: 100,
  },
  {
    kind: "EXPENSE",
    slug: "gifts",
    labelRu: "Подарки",
    iconName: "expense-gifts",
    sortOrder: 110,
  },
  {
    kind: "EXPENSE",
    slug: "travel",
    labelRu: "Путешествия",
    iconName: "expense-travel",
    sortOrder: 120,
  },
  {
    kind: "EXPENSE",
    slug: "other-expense",
    labelRu: "Другое",
    iconName: "expense-other",
    sortOrder: 130,
  },
] as const satisfies readonly ExpenseCategoryEntry[];

export const SYSTEM_CATEGORIES: readonly SystemCategoryEntry[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

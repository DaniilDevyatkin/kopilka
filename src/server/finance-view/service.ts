import "server-only";

import type {
  OperationType,
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type OperationRow = Prisma.FinancialOperationGetPayload<{
  include: {
    category: { select: { labelRu: true; iconName: true } };
    ledgerEntries: { include: { account: { select: { name: true } } } };
    reversedBy: { select: { id: true } };
    supersededBy: { select: { id: true } };
  };
}>;

export interface FinanceOperationReadModel {
  id: string;
  type: OperationType;
  categoryLabel: string | null;
  categoryId: string | null;
  categoryIcon: string | null;
  note: string | null;
  occurredAt: Date;
  amountMinor: bigint;
  accounts: string[];
  entries: Array<{
    accountId: string;
    accountName: string;
    amountMinor: bigint;
  }>;
  reversed: boolean;
  superseded: boolean;
}

export interface AnalyticsReadModel {
  months: Array<{
    key: string;
    label: string;
    incomeMinor: bigint;
    expenseMinor: bigint;
  }>;
  expenseCategories: Array<{
    label: string;
    iconName: string;
    amountMinor: bigint;
  }>;
  incomeMinor: bigint;
  expenseMinor: bigint;
  savingsMinor: bigint;
}

export interface OperationSearchFilters {
  type?: OperationType;
  accountId?: string;
  categoryId?: string;
  query?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export interface OperationSearchResult {
  items: FinanceOperationReadModel[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function amountForOperation(operation: OperationRow): bigint {
  if (operation.type === "TRANSFER") {
    return operation.ledgerEntries.reduce(
      (largest, entry) =>
        absolute(entry.amountMinor) > largest
          ? absolute(entry.amountMinor)
          : largest,
      0n,
    );
  }
  return operation.ledgerEntries.reduce(
    (sum, entry) => sum + entry.amountMinor,
    0n,
  );
}

function toReadModel(operation: OperationRow): FinanceOperationReadModel {
  return {
    id: operation.id,
    type: operation.type,
    categoryLabel: operation.category?.labelRu ?? null,
    categoryId: operation.categoryId,
    categoryIcon: operation.category?.iconName ?? null,
    note: operation.note,
    occurredAt: operation.occurredAt,
    amountMinor: amountForOperation(operation),
    accounts: operation.ledgerEntries.map((entry) => entry.account.name),
    entries: operation.ledgerEntries.map((entry) => ({
      accountId: entry.accountId,
      accountName: entry.account.name,
      amountMinor: entry.amountMinor,
    })),
    reversed: operation.reversedBy !== null,
    superseded: operation.supersededBy.length > 0,
  };
}

function localMonthKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function precedingMonths(count: number, now: Date, timeZone: string): string[] {
  const [localYear, localMonth] = localMonthKey(now, timeZone)
    .split("-")
    .map(Number);
  const currentMonthIndex = localYear! * 12 + localMonth! - 1;
  const result: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const monthIndex = currentMonthIndex - offset;
    const year = Math.floor(monthIndex / 12);
    const month = (((monthIndex % 12) + 12) % 12) + 1;
    result.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return result;
}

interface OperationRowQuery {
  take?: number;
  skip?: number;
  where?: Prisma.FinancialOperationWhereInput;
}

export function createFinanceViewService(
  database: PrismaClient,
  now = () => new Date(),
) {
  async function operationRows(
    userId: string,
    query: OperationRowQuery = {},
  ): Promise<OperationRow[]> {
    return database.financialOperation.findMany({
      where: query.where ? { userId, AND: query.where } : { userId },
      include: {
        category: { select: { labelRu: true, iconName: true } },
        ledgerEntries: {
          include: { account: { select: { name: true } } },
          orderBy: { role: "asc" },
        },
        reversedBy: { select: { id: true } },
        supersededBy: { select: { id: true } },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      ...(query.take === undefined ? {} : { take: query.take }),
      ...(query.skip === undefined ? {} : { skip: query.skip }),
    });
  }

  async function listOperations(
    userId: string,
    type?: "INCOME" | "EXPENSE" | "TRANSFER",
  ): Promise<FinanceOperationReadModel[]> {
    const rows = await operationRows(userId, {
      take: 100,
      ...(type ? { where: { type } } : {}),
    });
    return rows.map(toReadModel);
  }

  async function searchOperations(
    userId: string,
    filters: OperationSearchFilters,
  ): Promise<OperationSearchResult> {
    const page = Math.max(1, Math.trunc(filters.page ?? 1));
    const pageSize = Math.min(
      50,
      Math.max(10, Math.trunc(filters.pageSize ?? 25)),
    );
    const text = filters.query?.trim().slice(0, 120);
    const occurredAt =
      filters.from || filters.to
        ? {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          }
        : undefined;
    const where: Prisma.FinancialOperationWhereInput = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(occurredAt ? { occurredAt } : {}),
      ...(filters.accountId
        ? { ledgerEntries: { some: { accountId: filters.accountId } } }
        : {}),
      ...(text
        ? {
            OR: [
              { note: { contains: text, mode: "insensitive" } },
              {
                category: { labelRu: { contains: text, mode: "insensitive" } },
              },
              {
                ledgerEntries: {
                  some: {
                    account: { name: { contains: text, mode: "insensitive" } },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const rows = await operationRows(userId, {
      take: pageSize + 1,
      skip: (page - 1) * pageSize,
      where,
    });
    return {
      items: rows.slice(0, pageSize).map(toReadModel),
      page,
      hasPrevious: page > 1,
      hasNext: rows.length > pageSize,
    };
  }

  async function getOperation(
    userId: string,
    operationId: string,
  ): Promise<FinanceOperationReadModel | null> {
    const operation = await database.financialOperation.findFirst({
      where: { id: operationId, userId },
      include: {
        category: { select: { labelRu: true, iconName: true } },
        ledgerEntries: {
          include: { account: { select: { name: true } } },
          orderBy: { role: "asc" },
        },
        reversedBy: { select: { id: true } },
        supersededBy: { select: { id: true } },
      },
    });
    return operation ? toReadModel(operation) : null;
  }

  async function getAnalytics(
    userId: string,
    timeZone: string,
    monthCount = 6,
  ): Promise<AnalyticsReadModel> {
    const current = now();
    const keys = precedingMonths(
      Math.min(12, Math.max(3, monthCount)),
      current,
      timeZone,
    );
    const [firstYear, firstMonth] = keys[0]!.split("-").map(Number);
    const roughLowerBound = new Date(
      Date.UTC(firstYear!, firstMonth! - 1, 1) - 2 * 86_400_000,
    );
    const rows = await operationRows(userId, {
      where: {
        type: { in: ["INCOME", "EXPENSE", "GOAL_PURCHASE"] },
        occurredAt: { gte: roughLowerBound },
        reversedBy: null,
        supersededBy: { none: {} },
      },
    });
    const monthMap = new Map(
      keys.map((key) => [key, { incomeMinor: 0n, expenseMinor: 0n }]),
    );
    const categoryMap = new Map<
      string,
      { label: string; iconName: string; amountMinor: bigint }
    >();
    let incomeMinor = 0n;
    let expenseMinor = 0n;
    const currentKey = localMonthKey(current, timeZone);

    for (const operation of rows) {
      const key = localMonthKey(operation.occurredAt, timeZone);
      const amount = absolute(amountForOperation(operation));
      const month = monthMap.get(key);
      if (month) {
        if (operation.type === "INCOME") month.incomeMinor += amount;
        else month.expenseMinor += amount;
      }
      if (key !== currentKey) continue;
      if (operation.type === "INCOME") incomeMinor += amount;
      else {
        expenseMinor += amount;
        const label = operation.category?.labelRu ?? "Без категории";
        const category = categoryMap.get(label) ?? {
          label,
          iconName: operation.category?.iconName ?? "categories",
          amountMinor: 0n,
        };
        category.amountMinor += amount;
        categoryMap.set(label, category);
      }
    }

    const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "short" });
    return {
      months: keys.map((key) => {
        const [year, month] = key.split("-").map(Number);
        const values = monthMap.get(key)!;
        return {
          key,
          label: monthFormatter
            .format(new Date(Date.UTC(year!, month! - 1, 1)))
            .replace(".", ""),
          ...values,
        };
      }),
      expenseCategories: [...categoryMap.values()].sort((left, right) =>
        left.amountMinor === right.amountMinor
          ? 0
          : left.amountMinor > right.amountMinor
            ? -1
            : 1,
      ),
      incomeMinor,
      expenseMinor,
      savingsMinor: incomeMinor - expenseMinor,
    };
  }

  return { listOperations, searchOperations, getOperation, getAnalytics };
}

export const financeViewService = createFinanceViewService(prisma);

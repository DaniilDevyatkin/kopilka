import "server-only";

import type {
  Currency,
  OperationType,
  PrismaClient,
} from "@/generated/prisma/client";
import { accountService } from "@/server/accounts/index";
import type { AccountReadModel } from "@/server/accounts/service";
import { prisma } from "@/server/db/prisma";
import { goalService } from "@/server/goals/index";
import type { GoalReadModel } from "@/server/goals/service";

export interface DashboardOperation {
  id: string;
  type: OperationType;
  note: string | null;
  categoryLabel: string | null;
  occurredAt: Date;
  amountMinor: bigint;
}

export interface DashboardReadModel {
  currency: Currency;
  accounts: AccountReadModel[];
  goals: GoalReadModel[];
  totalCapitalMinor: bigint;
  reservedMinor: bigint;
  freeMinor: bigint;
  monthIncomeMinor: bigint;
  monthExpenseMinor: bigint;
  recentOperations: DashboardOperation[];
}

export function createDashboardService(database: PrismaClient) {
  async function getDashboard(
    userId: string,
    currency: Currency,
  ): Promise<DashboardReadModel> {
    const settings = await database.userSettings.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    const timeZone = settings?.timeZone ?? "Europe/Moscow";
    const localMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const monthStart = `${localMonth}-01`;

    const [accounts, goals, monthRows, operationRows] = await Promise.all([
      accountService.listAccounts(userId),
      goalService.listGoals(userId, "ACTIVE"),
      database.$queryRaw<Array<{ incomeMinor: bigint; expenseMinor: bigint }>>`
        SELECT
          COALESCE(SUM(CASE WHEN operation."type" = 'INCOME' THEN entry."amountMinor" ELSE 0 END), 0)::bigint AS "incomeMinor",
          COALESCE(SUM(CASE WHEN operation."type" IN ('EXPENSE', 'GOAL_PURCHASE') THEN -entry."amountMinor" ELSE 0 END), 0)::bigint AS "expenseMinor"
        FROM "ledger_entries" AS entry
        INNER JOIN "financial_operations" AS operation
          ON operation."id" = entry."operationId"
          AND operation."userId" = entry."userId"
        WHERE entry."userId" = ${userId}::uuid
          AND operation."occurredAt" >= (${monthStart}::date::timestamp AT TIME ZONE ${timeZone})
          AND operation."occurredAt" < ((${monthStart}::date + INTERVAL '1 month')::timestamp AT TIME ZONE ${timeZone})
          AND NOT EXISTS (
            SELECT 1
            FROM "financial_operations" AS replacement
            WHERE replacement."userId" = operation."userId"
              AND (
                replacement."reversesOperationId" = operation."id"
                OR replacement."supersedesOperationId" = operation."id"
              )
          )
      `,
      database.$queryRaw<
        Array<{
          id: string;
          type: OperationType;
          note: string | null;
          categoryLabel: string | null;
          occurredAt: Date;
          amountMinor: bigint;
        }>
      >`
        SELECT
          operation."id",
          operation."type",
          operation."note",
          category."labelRu" AS "categoryLabel",
          operation."occurredAt",
          CASE
            WHEN operation."type" = 'TRANSFER' THEN MAX(ABS(entry."amountMinor"))
            ELSE SUM(entry."amountMinor")
          END::bigint AS "amountMinor"
        FROM "financial_operations" AS operation
        INNER JOIN "ledger_entries" AS entry
          ON entry."operationId" = operation."id"
          AND entry."userId" = operation."userId"
        LEFT JOIN "categories" AS category ON category."id" = operation."categoryId"
        WHERE operation."userId" = ${userId}::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM "financial_operations" AS replacement
            WHERE replacement."userId" = operation."userId"
              AND (
                replacement."reversesOperationId" = operation."id"
                OR replacement."supersedesOperationId" = operation."id"
              )
          )
        GROUP BY operation."id", category."labelRu"
        ORDER BY operation."occurredAt" DESC, operation."id" DESC
        LIMIT 8
      `,
    ]);

    const totalCapitalMinor = accounts.reduce(
      (total, account) => total + account.balanceMinor,
      0n,
    );
    const reservedMinor = goals.reduce(
      (total, goal) => total + goal.reservedAmountMinor,
      0n,
    );

    return {
      currency,
      accounts,
      goals,
      totalCapitalMinor,
      reservedMinor,
      freeMinor: totalCapitalMinor - reservedMinor,
      monthIncomeMinor: BigInt(monthRows[0]?.incomeMinor ?? 0n),
      monthExpenseMinor: BigInt(monthRows[0]?.expenseMinor ?? 0n),
      recentOperations: operationRows.map((row) => ({
        ...row,
        occurredAt: new Date(row.occurredAt),
        amountMinor: BigInt(row.amountMinor),
      })),
    };
  }

  return { getDashboard };
}

export const dashboardService = createDashboardService(prisma);

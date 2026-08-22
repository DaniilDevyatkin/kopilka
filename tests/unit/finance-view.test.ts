import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/prisma", () => ({ prisma: {} }));

import type { PrismaClient } from "@/generated/prisma/client";
import { createFinanceViewService } from "@/server/finance-view/service";

function databaseWithRows(rows: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rows);
  return {
    database: {
      financialOperation: { findMany },
    } as unknown as PrismaClient,
    findMany,
  };
}

describe("finance view queries", () => {
  it("filters operation type in PostgreSQL before applying the page limit", async () => {
    const { database, findMany } = databaseWithRows();
    const service = createFinanceViewService(database);

    await service.listOperations(
      "00000000-0000-4000-8000-000000000001",
      "INCOME",
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({
          AND: { type: "INCOME" },
        }),
      }),
    );
  });

  it("uses the user's local month at an UTC month boundary and has no arbitrary analytics cap", async () => {
    const { database, findMany } = databaseWithRows();
    const service = createFinanceViewService(
      database,
      () => new Date("2026-01-31T21:30:00.000Z"),
    );

    const analytics = await service.getAnalytics(
      "00000000-0000-4000-8000-000000000001",
      "Asia/Tokyo",
    );

    expect(analytics.months.map((month) => month.key)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("take");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.objectContaining({
            reversedBy: null,
            supersededBy: { none: {} },
          }),
        }),
      }),
    );
  });
});

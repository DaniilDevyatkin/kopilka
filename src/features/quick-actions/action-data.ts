"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ClientAccount } from "@/lib/accounts/dto";
import { listAccountsAction } from "@/server/actions/accounts";
import { listCategoriesAction } from "@/server/actions/categories";
import { listGoalsAction } from "@/server/actions/goals";
import type { CategoryReadModel } from "@/server/categories/service";
import type { GoalReadModel } from "@/server/goals/service";

export interface QuickActionData {
  accounts: ClientAccount[];
  categoriesByKind: Record<"INCOME" | "EXPENSE", CategoryReadModel[]>;
  goals: GoalReadModel[];
  loading: boolean;
  error: string | null;
}

export function useQuickActionData(enabled: boolean) {
  const [data, setData] = useState<QuickActionData>({
    accounts: [],
    categoriesByKind: { INCOME: [], EXPENSE: [] },
    goals: [],
    loading: false,
    error: null,
  });
  const wasEnabledRef = useRef(false);

  const load = useCallback(async () => {
    setData((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const [accounts, incomeCategories, expenseCategories, goals] =
        await Promise.all([
          listAccountsAction(),
          listCategoriesAction("INCOME"),
          listCategoriesAction("EXPENSE"),
          listGoalsAction("ACTIVE"),
        ]);
      if (!accounts.ok) throw new Error(accounts.message);
      if (!incomeCategories.ok) throw new Error(incomeCategories.message);
      if (!expenseCategories.ok) throw new Error(expenseCategories.message);
      if (!goals.ok) throw new Error(goals.message);
      setData({
        accounts: accounts.data,
        categoriesByKind: {
          INCOME: incomeCategories.data,
          EXPENSE: expenseCategories.data,
        },
        goals: goals.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      setData((previous) => ({
        ...previous,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось загрузить данные. Попробуйте ещё раз.",
      }));
    }
  }, []);

  useEffect(() => {
    const wasEnabled = wasEnabledRef.current;
    wasEnabledRef.current = enabled;
    if (!enabled || wasEnabled) return;
    void load();
  }, [enabled, load]);

  return { ...data, reload: load };
}

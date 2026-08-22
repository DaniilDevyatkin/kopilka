import type { Metadata } from "next";
import Link from "next/link";

import { AppIcon } from "@/components/icons";
import { GoalForm } from "@/features/goals/goal-form";
import styles from "@/features/goals/goals.module.css";
import { serializeMoney, type SupportedCurrency } from "@/lib/money";
import { accountService } from "@/server/accounts/index";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";

export const metadata: Metadata = { title: "Новая хотелка — Копилка" };

export default async function NewGoalPage() {
  const user = await guardPrivateRoute();
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { timeZone: true, mandatoryMonthlyExpensesMinor: true },
  });
  const accounts = (await accountService.listAccounts(user.id))
    .filter(
      (account) =>
        !account.archivedAt && account.currency === user.baseCurrency,
    )
    .map((account) => ({ id: account.id, name: account.name }));

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Новая хотелка</p>
          <h1>Сформулируйте цель</h1>
        </div>
        <Link className={styles.tab} href="/app/goals">
          <AppIcon name="back" size={20} />
          Назад
        </Link>
      </header>
      <GoalForm
        currency={user.baseCurrency as SupportedCurrency}
        accounts={accounts}
        timeZone={settings?.timeZone ?? "Europe/Moscow"}
        {...(settings?.mandatoryMonthlyExpensesMinor
          ? {
              emergencyTargets: {
                threeMonths: serializeMoney(
                  settings.mandatoryMonthlyExpensesMinor * 3n,
                ),
                sixMonths: serializeMoney(
                  settings.mandatoryMonthlyExpensesMinor * 6n,
                ),
              },
            }
          : {})}
      />
    </div>
  );
}

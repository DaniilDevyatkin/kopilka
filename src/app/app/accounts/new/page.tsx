import type { Metadata } from "next";

import { AccountForm } from "@/features/accounts/account-form";
import type { SupportedCurrency } from "@/lib/money";
import { createAccountAction } from "@/server/actions/accounts";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import styles from "@/features/accounts/accounts.module.css";

export const metadata: Metadata = { title: "Новый счёт — Копилка" };

export default async function NewAccountPage() {
  const user = await guardPrivateRoute();
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.eyebrow}>Счета</p>
        <h1 className={styles.pageTitle}>Новый счёт</h1>
        <p className={styles.pageDescription}>
          Карта, наличные или накопительный — укажите начальный баланс,
          остальное Копилка посчитает сама.
        </p>
      </div>
      <AccountForm
        mode="create"
        baseCurrency={user.baseCurrency as SupportedCurrency}
        successPath="/app/accounts"
        submitCreate={createAccountAction}
      />
    </div>
  );
}

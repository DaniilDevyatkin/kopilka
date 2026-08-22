import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountForm } from "@/features/accounts/account-form";
import { toClientAccount } from "@/lib/accounts/dto";
import { updateAccountAction } from "@/server/actions/accounts";
import { AccountError } from "@/server/accounts/errors";
import { accountService } from "@/server/accounts/index";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import styles from "@/features/accounts/accounts.module.css";

export const metadata: Metadata = { title: "Изменить счёт — Копилка" };

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await guardPrivateRoute();
  let account;
  try {
    const detail = await accountService.getAccountDetail(user.id, id);
    account = detail.account;
  } catch (error) {
    if (error instanceof AccountError && error.code === "ACCOUNT_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <p className={styles.eyebrow}>Счета</p>
        <h1 className={styles.pageTitle}>Изменить счёт</h1>
        <p className={styles.pageDescription}>
          Название, визуальный стиль и реквизиты карты. Баланс меняется через
          корректировку, а не здесь.
        </p>
      </div>
      <AccountForm
        mode="edit"
        initial={toClientAccount(account)}
        successPath={`/app/accounts/${id}`}
        submitUpdate={updateAccountAction}
      />
    </div>
  );
}

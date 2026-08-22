import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AppIcon, type AppIconName } from "@/components/icons";
import styles from "@/features/finance/finance.module.css";
import { formatCurrency, type SupportedCurrency } from "@/lib/money";
import { resolveIanaTimeZone } from "@/lib/dates";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";
import { financeViewService } from "@/server/finance-view/service";

export const metadata: Metadata = { title: "История — Копилка" };

const TYPE_COPY: Record<string, { label: string; icon: AppIconName }> = {
  INCOME: { label: "Доход", icon: "income" },
  EXPENSE: { label: "Расход", icon: "expense" },
  TRANSFER: { label: "Перевод", icon: "transfer" },
  OPENING_BALANCE: { label: "Стартовый баланс", icon: "savings" },
  BALANCE_ADJUSTMENT: { label: "Сверка баланса", icon: "edit" },
  GOAL_PURCHASE: { label: "Покупка по хотелке", icon: "target" },
  REVERSAL: { label: "Отмена операции", icon: "back" },
};

interface TransactionParams {
  page?: string;
}

function pageHref(page: number): string {
  return page > 1 ? `/app/transactions?page=${page}` : "/app/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionParams>;
}) {
  const user = await guardPrivateRoute();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { timeZone: true },
  });
  const timeZone = resolveIanaTimeZone(settings?.timeZone);
  const result = await financeViewService.searchOperations(user.id, { page });
  const currency = user.baseCurrency as SupportedCurrency;
  const groups = new Map<string, typeof result.items>();
  for (const operation of result.items) {
    const date = new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "long",
      timeZone,
    }).format(operation.occurredAt);
    groups.set(date, [...(groups.get(date) ?? []), operation]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>История</h1>
      </header>

      {result.items.length ? (
        [...groups.entries()].map(([date, operations]) => (
          <section className={styles.dateGroup} key={date}>
            <h2>{date}</h2>
            <ul className={styles.operationList}>
              {operations.map((operation) => {
                const copy = TYPE_COPY[operation.type] ?? {
                  label: "Операция",
                  icon: "transactions" as AppIconName,
                };
                const transfer = operation.type === "TRANSFER";
                const negative = !transfer && operation.amountMinor < 0n;
                const positive = !transfer && operation.amountMinor > 0n;
                const amount =
                  operation.amountMinor < 0n
                    ? -operation.amountMinor
                    : operation.amountMinor;
                const inactive = operation.reversed || operation.superseded;
                return (
                  <li
                    className={`${styles.operation} ${inactive ? styles.muted : ""}`}
                    key={operation.id}
                  >
                    <Link
                      className={styles.operationLink}
                      href={`/app/transactions/${operation.id}`}
                      aria-label={`Открыть операцию: ${operation.categoryLabel ?? copy.label}`}
                    >
                      <span className={styles.operationIcon} aria-hidden="true">
                        {operation.type === "OPENING_BALANCE" ? (
                          <Image
                            className={styles.generatedOperationIcon}
                            src="/assets/transactions/opening-balance.png"
                            alt=""
                            width={40}
                            height={40}
                          />
                        ) : (
                          <AppIcon name={copy.icon} size={20} />
                        )}
                      </span>
                      <span className={styles.operationCopy}>
                        <strong>{operation.categoryLabel ?? copy.label}</strong>
                        <small>
                          {operation.accounts.join(" → ")}
                          {operation.note ? ` · ${operation.note}` : ""}
                          {inactive ? " · отменена или изменена" : ""}
                        </small>
                      </span>
                      <strong
                        className={`${styles.amount} ${negative ? styles.negative : positive ? styles.positive : ""}`}
                        data-amount
                      >
                        {negative ? "−" : positive ? "+" : "↔ "}
                        {formatCurrency(amount, currency)}
                      </strong>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      ) : (
        <div className={styles.empty}>
          <p>История пока пустая.</p>
        </div>
      )}

      {result.hasPrevious || result.hasNext ? (
        <nav className={styles.pagination} aria-label="Страницы истории">
          {result.hasPrevious ? (
            <Link href={pageHref(result.page - 1)}>Назад</Link>
          ) : (
            <span />
          )}
          {result.hasNext ? (
            <Link href={pageHref(result.page + 1)}>Дальше</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppIcon, type AppIconName } from "@/components/icons";
import { TransferLifecycleActions } from "@/features/finance/transfer-lifecycle-actions";
import { OperationLifecycleActions } from "@/features/finance/operation-lifecycle-actions";
import styles from "@/features/finance/finance.module.css";
import {
  formatCurrency,
  serializeMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";
import { financeViewService } from "@/server/finance-view/service";

export const metadata: Metadata = { title: "Операция — Копилка" };

const COPY: Record<string, { label: string; icon: AppIconName }> = {
  INCOME: { label: "Доход", icon: "income" },
  EXPENSE: { label: "Расход", icon: "expense" },
  TRANSFER: { label: "Перевод", icon: "transfer" },
  OPENING_BALANCE: { label: "Начисление при создании", icon: "savings" },
  BALANCE_ADJUSTMENT: { label: "Сверка баланса", icon: "edit" },
  GOAL_PURCHASE: { label: "Покупка по хотелке", icon: "target" },
  REVERSAL: { label: "Компенсирующая операция", icon: "back" },
};

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPrivateRoute();
  const { id } = await params;
  const operation = await financeViewService.getOperation(user.id, id);
  if (!operation) notFound();
  const currency = user.baseCurrency as SupportedCurrency;
  const copy = COPY[operation.type] ?? {
    label: "Операция",
    icon: "transactions" as AppIconName,
  };
  const inactive = operation.reversed || operation.superseded;
  const source = operation.entries.find((entry) => entry.amountMinor < 0n);
  const destination = operation.entries.find((entry) => entry.amountMinor > 0n);
  const accounts =
    ["TRANSFER", "INCOME", "EXPENSE"].includes(operation.type) && !inactive
      ? await prisma.account.findMany({
          where: { userId: user.id, archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, currency: true },
        })
      : [];
  const categories =
    operation.type === "INCOME" || operation.type === "EXPENSE"
      ? await prisma.category.findMany({
          where: {
            kind: operation.type,
            archivedAt: null,
            OR: [{ ownerUserId: null }, { ownerUserId: user.id }],
          },
          orderBy: { sortOrder: "asc" },
          select: { id: true, labelRu: true },
        })
      : [];

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/app/transactions">
        <AppIcon name="back" size={20} />
        История
      </Link>
      <article className={styles.operationDetail}>
        <span className={styles.operationIcon} aria-hidden="true">
          <AppIcon name={copy.icon} size={24} />
        </span>
        <p>{copy.label}</p>
        <h1>{operation.categoryLabel ?? copy.label}</h1>
        <strong className={styles.detailAmount} data-amount>
          {formatCurrency(
            operation.amountMinor < 0n
              ? -operation.amountMinor
              : operation.amountMinor,
            currency,
          )}
        </strong>
        {inactive ? (
          <span className={styles.inactiveBadge}>
            Операция отменена или заменена
          </span>
        ) : null}
        <dl className={styles.detailList}>
          <div>
            <dt>Дата</dt>
            <dd>
              {new Intl.DateTimeFormat("ru-RU", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(operation.occurredAt)}
            </dd>
          </div>
          <div>
            <dt>{operation.type === "TRANSFER" ? "Маршрут" : "Карта"}</dt>
            <dd>{operation.accounts.join(" → ")}</dd>
          </div>
          {operation.note ? (
            <div>
              <dt>Комментарий</dt>
              <dd>{operation.note}</dd>
            </div>
          ) : null}
          <div>
            <dt>Идентификатор</dt>
            <dd className={styles.mono}>{operation.id}</dd>
          </div>
        </dl>
      </article>
      {operation.type === "TRANSFER" &&
      !inactive &&
      source &&
      destination &&
      accounts.length >= 2 ? (
        <TransferLifecycleActions
          transferId={operation.id}
          amountMinor={serializeMoney(operation.amountMinor)}
          sourceAccountId={source.accountId}
          destinationAccountId={destination.accountId}
          note={operation.note}
          occurredAt={operation.occurredAt.toISOString()}
          accounts={accounts}
        />
      ) : null}
      {(operation.type === "INCOME" || operation.type === "EXPENSE") &&
      !inactive &&
      operation.entries.length === 1 &&
      operation.categoryId ? (
        <OperationLifecycleActions
          operation={{
            id: operation.id,
            kind: operation.type,
            amountMinor: serializeMoney(
              operation.amountMinor < 0n
                ? -operation.amountMinor
                : operation.amountMinor,
            ),
            accountId: operation.entries[0]!.accountId,
            categoryId: operation.categoryId,
            note: operation.note,
            occurredAt: operation.occurredAt.toISOString(),
            currency,
          }}
          accounts={accounts}
          categories={categories.map((category) => ({
            id: category.id,
            label: category.labelRu,
          }))}
        />
      ) : null}
    </div>
  );
}

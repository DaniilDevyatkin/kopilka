"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";

import { LineChart } from "@/components/charts";
import { AppIcon, type AppIconName } from "@/components/icons";
import {
  Button,
  DestructiveConfirmation,
  Dialog,
  ErrorState,
  FormField,
  MoneyInput,
  Skeleton,
  StateAction,
  StatusMessage,
  SubmitButton,
} from "@/components/ui";
import {
  accountKindForType,
  accountTypeLabel,
  cardThemeImage,
} from "@/lib/accounts/catalog";
import type {
  ClientAccountDetail,
  ClientBalancePoint,
  ClientDetailTransaction,
} from "@/lib/accounts/dto";
import {
  deserializeMoney,
  formatCurrency,
  parseMoney,
  type SupportedCurrency,
} from "@/lib/money";
import {
  archiveAccountAction,
  deleteAccountAction,
  getAccountDetailAction,
  reconcileAccountAction,
} from "@/server/actions/accounts";
import styles from "./accounts.module.css";

type DetailState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "offline" }
  | { phase: "ready"; detail: ClientAccountDetail };

interface ReconcileFormState {
  attempt: number;
  result?: { ok: boolean; message: string };
}

const INITIAL_STATE: ReconcileFormState = { attempt: 0 };

const NETWORK_FAILURE = {
  ok: false,
  message:
    "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
};

function moneyText(minor: bigint, currency: SupportedCurrency): string {
  return formatCurrency(minor, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function monthLabel(yearMonth: string): string {
  const date = new Date(`${yearMonth}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)}.${month}`;
}

function buildChartView(
  balanceSeries: ClientBalancePoint[],
  currency: SupportedCurrency,
) {
  const first = balanceSeries[0];
  const last = balanceSeries.at(-1);
  if (!first || !last) return null;
  const middle = balanceSeries[Math.floor(balanceSeries.length / 2)];
  const labels = [first.day];
  if (middle && middle.day !== first.day && middle.day !== last.day) {
    labels.push(middle.day);
  }
  if (last.day !== first.day) labels.push(last.day);
  return {
    points: balanceSeries.map((point) => ({
      x: point.day,
      value: deserializeMoney(point.balanceMinor),
    })),
    xLabels: labels.map(dayLabel),
    firstText: moneyText(deserializeMoney(first.balanceMinor), currency),
    lastText: moneyText(deserializeMoney(last.balanceMinor), currency),
  };
}

const TYPE_LABELS: Record<string, string> = {
  INCOME: "Доход",
  EXPENSE: "Расход",
  TRANSFER: "Перевод",
  OPENING: "Открытие счёта",
  RECONCILE: "Корректировка баланса",
};

function transactionAmount(
  transaction: ClientDetailTransaction,
  currency: SupportedCurrency,
): string {
  const isOutflow =
    transaction.role === "TRANSFER_SOURCE" || transaction.type === "EXPENSE";
  const isInflow =
    transaction.role === "TRANSFER_DESTINATION" ||
    transaction.type === "INCOME";
  const amount = deserializeMoney(transaction.amountMinor);
  const text = moneyText(amount < 0n ? -amount : amount, currency);
  if (isOutflow) return `−${text}`;
  if (isInflow) return `+${text}`;
  return moneyText(amount, currency);
}

function transactionIcon(transaction: ClientDetailTransaction) {
  if (transaction.categoryIcon) {
    return transaction.categoryIcon as AppIconName;
  }
  if (transaction.type === "INCOME") return "income";
  if (transaction.type === "EXPENSE") return "expense";
  if (transaction.type === "TRANSFER") return "transfer";
  return "calendar";
}

export function AccountDetail({
  accountId,
  initialDetail,
}: {
  accountId: string;
  initialDetail?: ClientAccountDetail;
}) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>(
    initialDetail
      ? { phase: "ready", detail: initialDetail }
      : { phase: "loading" },
  );
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState({ phase: "offline" });
      return;
    }
    const result = await getAccountDetailAction(accountId);
    if (!result.ok) {
      setState({ phase: "error", message: result.message });
      return;
    }
    setState({ phase: "ready", detail: result.data });
  }, [accountId]);

  useEffect(() => {
    if (initialDetail) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [initialDetail, load]);

  const [reconcileState, reconcileFormAction, reconcilePending] =
    useActionState(
      async (
        previous: ReconcileFormState,
        formData: FormData,
      ): Promise<ReconcileFormState> => {
        if (state.phase !== "ready") return previous;
        const currency = state.detail.account.currency as SupportedCurrency;
        const raw = String(formData.get("actualBalanceMinor") ?? "");
        let actual: bigint;
        try {
          actual = parseMoney(raw, {
            currency,
            locale: "ru-RU",
            allowNegative: true,
          });
        } catch {
          return {
            attempt: previous.attempt + 1,
            result: {
              ok: false,
              message:
                raw.trim() === ""
                  ? "Укажите фактический баланс."
                  : "Неверная сумма.",
            },
          };
        }
        try {
          const result = await reconcileAccountAction({
            accountId,
            actualBalanceMinor: actual,
            idempotencyKey: crypto.randomUUID(),
          });
          if (result.ok) {
            setReconcileOpen(false);
            void load();
          }
          return {
            attempt: previous.attempt + 1,
            result: result.ok
              ? { ok: true, message: "" }
              : { ok: false, message: result.message },
          };
        } catch {
          return { attempt: previous.attempt + 1, result: NETWORK_FAILURE };
        }
      },
      INITIAL_STATE,
    );

  async function handleArchive() {
    setArchivePending(true);
    setArchiveError(null);
    const result = await archiveAccountAction(accountId);
    if (result.ok) {
      router.replace("/app/accounts");
      router.refresh();
      return;
    }
    setArchiveError(result.message);
    setArchivePending(false);
  }

  async function handleDelete() {
    setDeletePending(true);
    setDeleteError(null);
    const result = await deleteAccountAction(accountId);
    if (result.ok) {
      router.replace("/app/accounts");
      router.refresh();
      return;
    }
    setDeleteError(result.message);
    setDeletePending(false);
  }

  if (state.phase === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton variant="text" lines={2} label="Загружаем счёт" />
        <Skeleton variant="card" lines={3} label="Загружаем счёт" />
        <Skeleton variant="card" lines={5} label="Загружаем счёт" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <ErrorState
        title="Не удалось загрузить счёт"
        description={state.message}
        action={<StateAction onClick={load}>Повторить</StateAction>}
      />
    );
  }

  if (state.phase === "offline") {
    return (
      <div className={styles.page}>
        <StatusMessage tone="warning" className={styles.offlineBanner}>
          Нет соединения с интернетом. Подключитесь и попробуйте снова.
        </StatusMessage>
        <StateAction onClick={load}>Повторить</StateAction>
      </div>
    );
  }

  const { detail } = state;
  const { account, month, balanceSeries, recentTransactions } = detail;
  const currency = account.currency as SupportedCurrency;
  const kind = accountKindForType(account.type);
  const isArchived = account.archivedAt !== null;
  const chartView =
    balanceSeries.length > 0 ? buildChartView(balanceSeries, currency) : null;

  return (
    <div className={styles.page}>
      <div className={styles.detailHeader}>
        <Link className={styles.backLink} href="/app/accounts">
          <AppIcon name="back" size={16} />
          Все счета
        </Link>
        <p className={styles.eyebrow}>{accountTypeLabel(account.type)}</p>
        <h1 className={styles.pageTitle}>{account.name}</h1>
      </div>

      <section
        className={styles.balanceCard}
        data-kind={kind}
        data-theme={account.visualTheme}
        aria-label="Текущий баланс"
      >
        <Image
          className={styles.cardImage}
          src={
            account.imageAssetId
              ? `/api/accounts/images/${account.imageAssetId}`
              : cardThemeImage(account.visualTheme)
          }
          alt=""
          fill
          unoptimized={Boolean(account.imageAssetId)}
          sizes="(max-width: 640px) 100vw, 760px"
        />
        <span className={styles.cardImageShade} aria-hidden="true" />
        <div className={styles.balanceHeader}>
          <h2 className={styles.balanceTitle}>Текущий баланс</h2>
          {isArchived ? (
            <span className={styles.archivedBadge}>
              <AppIcon name="archive" size={16} />В архиве
            </span>
          ) : null}
        </div>
        <p className={styles.bigBalance} data-amount>
          {moneyText(deserializeMoney(account.balanceMinor), currency)}
        </p>
        <div className={styles.balanceMeta}>
          {account.last4 ? (
            <span className={styles.last4Chip}>••{account.last4}</span>
          ) : null}
          <span>{currency}</span>
        </div>
        {!isArchived ? (
          <>
            <p className={styles.reserveNote} data-amount>
              Доступно:{" "}
              {moneyText(deserializeMoney(account.availableMinor), currency)}
              {account.reservedMinor !== "0" ? (
                <>
                  {" "}
                  · Зарезервировано на цели:{" "}
                  {moneyText(deserializeMoney(account.reservedMinor), currency)}
                </>
              ) : null}
            </p>
            <div className={styles.balanceActions}>
              <Link
                className={styles.cancelLink}
                href={`/app/accounts/${account.id}/edit`}
              >
                <AppIcon name="edit" size={16} />
                Изменить
              </Link>
              <Button
                className={styles.actionButton}
                variant="secondary"
                onClick={() => setReconcileOpen(true)}
              >
                Скорректировать баланс
              </Button>
              <Button
                className={styles.actionButton}
                variant="danger"
                onClick={() => setArchiveOpen(true)}
              >
                <AppIcon name="archive" size={16} />В архив
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.balanceActions}>
            <Button
              className={styles.actionButton}
              variant="danger"
              onClick={() => setDeleteOpen(true)}
            >
              Удалить пустой счёт
            </Button>
          </div>
        )}
      </section>

      <section className={styles.statsRow} aria-label="Движение за месяц">
        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            <AppIcon name="income" size={16} />
            Поступления за {monthLabel(month.yearMonth)}
          </span>
          <p className={`${styles.statValue} ${styles.statInflow}`} data-amount>
            {moneyText(deserializeMoney(month.inflowMinor), currency)}
          </p>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>
            <AppIcon name="expense" size={16} />
            Расходы за {monthLabel(month.yearMonth)}
          </span>
          <p
            className={`${styles.statValue} ${styles.statOutflow}`}
            data-amount
          >
            {moneyText(deserializeMoney(month.outflowMinor), currency)}
          </p>
        </div>
      </section>

      <section className={styles.chartCard} aria-label="Динамика баланса">
        <div>
          <h2 className={styles.chartTitle}>Динамика баланса</h2>
          <p className={styles.chartHint}>
            Последние 30 дней по вашей временной зоне.
          </p>
        </div>
        {chartView ? (
          <LineChart
            points={chartView.points}
            xLabels={chartView.xLabels}
            summary={`Динамика баланса ${account.name} за последние 30 дней: от ${chartView.firstText} до ${chartView.lastText}.`}
          />
        ) : (
          <p className={styles.chartHint}>
            За последние 30 дней не было операций — график появится после
            первого движения.
          </p>
        )}
      </section>

      <section
        className={styles.transactionsCard}
        aria-label="Последние операции"
      >
        <h2 className={styles.chartTitle}>Последние операции</h2>
        {recentTransactions.length === 0 ? (
          <p className={styles.chartHint}>Операций по счёту пока нет.</p>
        ) : (
          <ul className={styles.transactionList}>
            {recentTransactions.map((transaction) => (
              <li
                className={styles.transactionItem}
                key={transaction.operationId}
              >
                <span className={styles.transactionIcon} aria-hidden="true">
                  <AppIcon name={transactionIcon(transaction)} size={20} />
                </span>
                <div className={styles.transactionCopy}>
                  <p className={styles.transactionTitle}>
                    {transaction.categoryLabel ??
                      transaction.note ??
                      TYPE_LABELS[transaction.type] ??
                      "Операция"}
                  </p>
                  <p className={styles.transactionSub}>
                    {new Intl.DateTimeFormat("ru-RU", {
                      day: "numeric",
                      month: "short",
                      timeZone: detail.timeZone,
                    }).format(new Date(transaction.occurredAt))}
                    {" · "}
                    {TYPE_LABELS[transaction.type] ?? "Операция"}
                  </p>
                </div>
                <p
                  data-amount
                  className={[
                    styles.transactionAmount,
                    transaction.role === "TRANSFER_SOURCE" ||
                    transaction.type === "EXPENSE"
                      ? styles.amountOutflow
                      : transaction.role === "TRANSFER_DESTINATION" ||
                          transaction.type === "INCOME"
                        ? styles.amountInflow
                        : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {transactionAmount(transaction, currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isArchived ? (
        <>
          <Dialog
            open={reconcileOpen}
            onOpenChange={setReconcileOpen}
            title="Скорректировать баланс"
            description="Приведите баланс в соответствие с реальностью: Копилка запишет разницу отдельной операцией."
            dismissible={!reconcilePending}
            closeOnBackdrop={!reconcilePending}
          >
            <form
              action={reconcileFormAction}
              className={styles.form}
              noValidate
            >
              <FormField
                label="Фактический баланс"
                hint="Можно со знаком минус, если долг больше лимита."
              >
                <MoneyInput
                  name="actualBalanceMinor"
                  currency={currency}
                  allowNegative
                  defaultValue=""
                />
              </FormField>
              {reconcileState.result && !reconcileState.result.ok ? (
                <p className={styles.formError} role="alert">
                  {reconcileState.result.message}
                </p>
              ) : null}
              <div className={styles.formActions}>
                <SubmitButton
                  className={styles.actionButton}
                  pending={reconcilePending}
                  pendingLabel="Считаем разницу"
                >
                  Сохранить
                </SubmitButton>
              </div>
            </form>
          </Dialog>

          <DestructiveConfirmation
            open={archiveOpen}
            onOpenChange={(open) => {
              setArchiveOpen(open);
              if (!open) setArchiveError(null);
            }}
            title="Переместить счёт в архив?"
            description="Счёт останется в архиве с историей, но по нему нельзя будет проводить операции."
            confirmLabel="В архив"
            pending={archivePending}
            onConfirm={() => void handleArchive()}
          />
          {archiveError ? (
            <StatusMessage tone="negative">{archiveError}</StatusMessage>
          ) : null}
        </>
      ) : (
        <>
          <DestructiveConfirmation
            open={deleteOpen}
            onOpenChange={(open) => {
              setDeleteOpen(open);
              if (!open) setDeleteError(null);
            }}
            title="Удалить пустой счёт?"
            description="Удаление возможно только если у счёта никогда не было операций или резервов. Исторические счета Копилка не удаляет."
            confirmLabel="Удалить"
            pending={deletePending}
            onConfirm={() => void handleDelete()}
          />
          {deleteError ? (
            <StatusMessage tone="negative">{deleteError}</StatusMessage>
          ) : null}
        </>
      )}
    </div>
  );
}

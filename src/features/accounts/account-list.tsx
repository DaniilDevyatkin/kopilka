"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { EmptyStateArtwork } from "@/components/graphics";
import { AppIcon } from "@/components/icons";
import {
  EmptyState,
  ErrorState,
  Skeleton,
  StateAction,
  StatusMessage,
} from "@/components/ui";
import {
  accountKindForType,
  accountTypeLabel,
  cardThemeImage,
} from "@/lib/accounts/catalog";
import type { ClientAccount } from "@/lib/accounts/dto";
import {
  deserializeMoney,
  formatCurrency,
  type SupportedCurrency,
} from "@/lib/money";
import { listAccountsAction } from "@/server/actions/accounts";
import styles from "./accounts.module.css";

type ListState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "offline" }
  | { phase: "ready"; accounts: ClientAccount[] };

function balanceText(account: ClientAccount): string {
  return formatCurrency(
    deserializeMoney(account.balanceMinor),
    account.currency as SupportedCurrency,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  );
}

function AccountCardLink({
  account,
  priority = false,
}: {
  account: ClientAccount;
  priority?: boolean;
}) {
  const kind = accountKindForType(account.type);
  return (
    <Link
      className={styles.accountCard}
      href={`/app/accounts/${account.id}`}
      data-kind={kind}
      data-theme={account.visualTheme}
      aria-label={`${account.name}, ${balanceText(account)}`}
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
        sizes="(max-width: 640px) 100vw, 360px"
        priority={priority}
      />
      <span className={styles.cardImageShade} aria-hidden="true" />
      <div className={styles.cardTop}>
        <span className={styles.accountMeta}>
          {accountTypeLabel(account.type)}
          {account.last4 ? (
            <span className={styles.last4Chip}>••{account.last4}</span>
          ) : null}
        </span>
        <h3 className={styles.accountName}>{account.name}</h3>
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.balanceLabel}>Баланс</span>
        <p className={styles.accountBalance} data-amount>
          {balanceText(account)}
        </p>
      </div>
    </Link>
  );
}

function ArchivedCard({ account }: { account: ClientAccount }) {
  const kind = accountKindForType(account.type);
  return (
    <article
      className={`${styles.accountCard} ${styles.archivedCard}`}
      data-kind={kind}
      data-theme={account.visualTheme}
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
        sizes="360px"
      />
      <span className={styles.cardImageShade} aria-hidden="true" />
      <div className={styles.cardTop}>
        <span className={styles.accountMeta}>
          <span className={styles.archivedBadge}>
            <AppIcon name="archive" size={16} />В архиве
          </span>
          {accountTypeLabel(account.type)}
        </span>
        <h3 className={styles.accountName}>{account.name}</h3>
      </div>
      <div className={styles.cardBottom}>
        <span className={styles.balanceLabel}>Баланс</span>
        <p className={styles.accountBalance} data-amount>
          {balanceText(account)}
        </p>
      </div>
    </article>
  );
}

export function AccountList({
  initialAccounts,
}: {
  initialAccounts?: ClientAccount[];
}) {
  const [state, setState] = useState<ListState>(
    initialAccounts
      ? { phase: "ready", accounts: initialAccounts }
      : { phase: "loading" },
  );

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const result = await listAccountsAction();
    if (!result.ok) {
      setState({ phase: "error" });
      return;
    }
    setState({ phase: "ready", accounts: result.data });
  }, []);

  useEffect(() => {
    if (initialAccounts) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [initialAccounts, load]);

  if (state.phase === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton variant="card" lines={3} label="Загружаем счета" />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <ErrorState
        title="Не удалось загрузить счета"
        description="Проверьте соединение и попробуйте ещё раз."
        action={<StateAction onClick={load}>Повторить</StateAction>}
      />
    );
  }

  if (state.phase === "offline") {
    return (
      <div className={styles.page}>
        <StatusMessage tone="warning" className={styles.offlineBanner}>
          Нет соединения. Показаны последние известные данные.
        </StatusMessage>
      </div>
    );
  }

  const accounts = state.accounts;
  const active = accounts.filter((account) => account.archivedAt === null);
  const archived = accounts.filter((account) => account.archivedAt !== null);

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Мои карты</h1>
        </div>
        <Link className={styles.primaryActionLink} href="/app/accounts/new">
          <AppIcon name="add" size={20} />
          Добавить
        </Link>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyArtwork}>
            <EmptyStateArtwork variant="accounts" />
          </div>
          <EmptyState
            title="Пока нет карт"
            description="Добавьте первую карту, чтобы начать вести баланс."
            action={
              <Link
                className={styles.primaryActionLink}
                href="/app/accounts/new"
              >
                Добавить карту
              </Link>
            }
          />
        </div>
      ) : null}

      {active.length > 0 ? (
        <section aria-label="Активные счета">
          <div className={styles.accountGrid}>
            {active.map((account, index) => (
              <AccountCardLink
                key={account.id}
                account={account}
                priority={index === 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      {archived.length > 0 ? (
        <section aria-label="Архив счетов">
          <h2 className={styles.sectionHeading}>
            В архиве
            <span className={styles.sectionCount}>{archived.length}</span>
          </h2>
          <div className={styles.accountGrid}>
            {archived.map((account) => (
              <ArchivedCard key={account.id} account={account} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

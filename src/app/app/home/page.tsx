import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AppIcon } from "@/components/icons";
import styles from "@/features/dashboard/dashboard.module.css";
import { OfflineSnapshotWriter } from "@/features/pwa/offline-snapshot-writer";
import { cardThemeImage } from "@/lib/accounts/catalog";
import { formatCurrency, type SupportedCurrency } from "@/lib/money";
import type { OfflineSnapshot } from "@/lib/pwa/offline-snapshot";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { dashboardService } from "@/server/dashboard/service";

export const metadata: Metadata = { title: "Главная — Копилка" };

const SNAPSHOT_OPERATION_TYPES = new Set([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "GOAL_PURCHASE",
]);
export default async function HomePage() {
  const user = await guardPrivateRoute();
  const dashboard = await dashboardService.getDashboard(
    user.id,
    user.baseCurrency,
  );
  const currency = dashboard.currency as SupportedCurrency;
  const primaryAccount = dashboard.accounts.find(
    (account) => !account.archivedAt,
  );
  const snapshot: OfflineSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    currency,
    totalCapitalMinor: dashboard.totalCapitalMinor.toString(),
    reservedMinor: dashboard.reservedMinor.toString(),
    freeMinor: dashboard.freeMinor.toString(),
    accounts: dashboard.accounts.map((account) => ({
      name: account.name,
      type: account.type,
      balanceMinor: account.balanceMinor.toString(),
    })),
    goals: dashboard.goals.map((goal) => ({
      name: goal.name,
      targetAmountMinor: goal.targetAmountMinor.toString(),
      reservedAmountMinor: goal.reservedAmountMinor.toString(),
      targetDate: goal.targetDate,
    })),
    operations: dashboard.recentOperations.flatMap((operation) =>
      SNAPSHOT_OPERATION_TYPES.has(operation.type)
        ? [
            {
              kind: operation.type as
                "INCOME" | "EXPENSE" | "TRANSFER" | "GOAL_PURCHASE",
              amountMinor: operation.amountMinor.toString(),
              comment: operation.note,
              occurredAt: operation.occurredAt.toISOString(),
            },
          ]
        : [],
    ),
  };

  return (
    <div className={styles.page}>
      <OfflineSnapshotWriter snapshot={snapshot} />
      <header className={styles.heading}>
        <div>
          <p>Добрый день, {user.displayName}</p>
          <h1>Главная</h1>
        </div>
        <div className={styles.headingActions}>
          <Link className={styles.allCardsLink} href="/app/accounts">
            Все карты
          </Link>
          <Link className={styles.iconAction} href="/app/accounts/new">
            <AppIcon name="add" size={20} />
            <span className={styles.visuallyHidden}>Добавить карту</span>
          </Link>
        </div>
      </header>

      <section className={styles.balanceHero} aria-label="Доступные деньги">
        {primaryAccount ? (
          <Image
            className={styles.heroArtwork}
            src={
              primaryAccount.imageAssetId
                ? `/api/accounts/images/${primaryAccount.imageAssetId}`
                : cardThemeImage(primaryAccount.visualTheme)
            }
            alt=""
            fill
            priority
            unoptimized={Boolean(primaryAccount.imageAssetId)}
            sizes="(max-width: 767px) 100vw, 760px"
          />
        ) : null}
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={styles.heroLabel}>Доступно сейчас</span>
          <strong className={styles.heroAmount} data-amount>
            {formatCurrency(dashboard.freeMinor, currency)}
          </strong>
          <div className={styles.heroStats}>
            <span data-amount>
              <small>Всего</small>
              {formatCurrency(dashboard.totalCapitalMinor, currency)}
            </span>
            <span data-amount>
              <small>В хотелках</small>
              {formatCurrency(dashboard.reservedMinor, currency)}
            </span>
          </div>
        </div>
      </section>

      <figure className={styles.savingsIllustration} aria-hidden="true">
        <Image
          src="/illustrations/home-savings-guardian.png"
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 767px) calc(100vw - 2.5rem), 760px"
        />
      </figure>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { APP_ICON_NAMES, AppIcon, type AppIconName } from "@/components/icons";
import styles from "@/features/finance/finance.module.css";
import { formatCurrency, type SupportedCurrency } from "@/lib/money";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";
import { financeViewService } from "@/server/finance-view/service";

export const metadata: Metadata = { title: "Аналитика — Копилка" };

const APP_ICON_NAME_SET = new Set<string>(APP_ICON_NAMES);

function iconName(value: string): AppIconName {
  return APP_ICON_NAME_SET.has(value) ? (value as AppIconName) : "categories";
}

function barHeight(value: bigint, maximum: bigint): string {
  if (value === 0n || maximum === 0n) return "0.2rem";
  const tenths = (value * 1000n) / maximum;
  return `${Number(tenths) / 10}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const user = await guardPrivateRoute();
  const params = await searchParams;
  const monthCount =
    params.months === "3" ? 3 : params.months === "12" ? 12 : 6;
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: { timeZone: true },
  });
  const analytics = await financeViewService.getAnalytics(
    user.id,
    settings?.timeZone ?? "Europe/Moscow",
    monthCount,
  );
  const currency = user.baseCurrency as SupportedCurrency;
  const maximum = analytics.months.reduce(
    (largest, month) =>
      month.incomeMinor > largest
        ? month.incomeMinor
        : month.expenseMinor > largest
          ? month.expenseMinor
          : largest,
    0n,
  );
  const categoryMaximum = analytics.expenseCategories[0]?.amountMinor ?? 0n;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Аналитика</p>
          <h1>Ритм ваших денег</h1>
        </div>
      </header>

      <nav className={styles.periodSelector} aria-label="Период аналитики">
        {[3, 6, 12].map((months) => (
          <Link
            key={months}
            href={`/app/analytics?months=${months}`}
            aria-current={monthCount === months ? "page" : undefined}
          >
            {months} мес.
          </Link>
        ))}
      </nav>

      <section
        className={styles.summaryGrid}
        aria-label="Итоги текущего месяца"
      >
        <article className={styles.summaryCard}>
          <p>Доходы</p>
          <strong className={styles.positive} data-amount>
            {formatCurrency(analytics.incomeMinor, currency)}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Расходы</p>
          <strong className={styles.negative} data-amount>
            {formatCurrency(analytics.expenseMinor, currency)}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <p>Осталось от дохода</p>
          <strong data-amount>
            {formatCurrency(analytics.savingsMinor, currency)}
          </strong>
        </article>
      </section>

      <section className={styles.panel} aria-labelledby="months-title">
        <h2 id="months-title">Последние {monthCount} месяцев</h2>
        <div className={styles.bars} aria-label="Доходы и расходы по месяцам">
          {analytics.months.map((month) => (
            <div className={styles.month} key={month.key}>
              <div className={styles.barPair}>
                <span
                  className={styles.bar}
                  aria-label={`${month.label}: доход ${formatCurrency(month.incomeMinor, currency)}`}
                  style={{ height: barHeight(month.incomeMinor, maximum) }}
                  title={`Доход: ${formatCurrency(month.incomeMinor, currency)}`}
                />
                <span
                  className={styles.bar}
                  data-kind="expense"
                  aria-label={`${month.label}: расход ${formatCurrency(month.expenseMinor, currency)}`}
                  style={{ height: barHeight(month.expenseMinor, maximum) }}
                  title={`Расход: ${formatCurrency(month.expenseMinor, currency)}`}
                />
              </div>
              <span>{month.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.legend}>
          <span>Доход</span>
          <span>Расход</span>
        </div>
        <table className={styles.visuallyHidden}>
          <caption>Доходы и расходы по месяцам</caption>
          <thead>
            <tr>
              <th>Месяц</th>
              <th>Доход</th>
              <th>Расход</th>
            </tr>
          </thead>
          <tbody>
            {analytics.months.map((month) => (
              <tr key={month.key}>
                <th>{month.label}</th>
                <td>{formatCurrency(month.incomeMinor, currency)}</td>
                <td>{formatCurrency(month.expenseMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.panel} aria-labelledby="categories-title">
        <h2 id="categories-title">Расходы по категориям в этом месяце</h2>
        {analytics.expenseCategories.length ? (
          <ul className={styles.categoryList}>
            {analytics.expenseCategories.map((category) => {
              const width = barHeight(category.amountMinor, categoryMaximum);
              return (
                <li className={styles.categoryRow} key={category.label}>
                  <span className={styles.operationIcon} aria-hidden="true">
                    <AppIcon name={iconName(category.iconName)} size={20} />
                  </span>
                  <div>
                    <span>{category.label}</span>
                    <div className={styles.categoryTrack} aria-hidden="true">
                      <span
                        className={styles.categoryFill}
                        style={{ width } as CSSProperties}
                      />
                    </div>
                  </div>
                  <strong className={styles.amount} data-amount>
                    {formatCurrency(category.amountMinor, currency)}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p>Расходов в этом месяце пока нет.</p>
          </div>
        )}
      </section>
    </div>
  );
}

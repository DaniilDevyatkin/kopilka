import type { CSSProperties } from "react";

import type { SupportedCurrency } from "@/lib/money";
import { formatCurrency } from "@/lib/money";
import { classNames } from "@/components/ui/class-names";
import styles from "./chart-primitives.module.css";
export interface WeekDayContribution {
  /** Short label, e.g. «Пн». */
  day: string;
  plannedMinor: bigint;
  contributedMinor: bigint;
}

export interface WeeklyPlanProgressProps {
  days: readonly WeekDayContribution[];
  plannedTotalMinor: bigint;
  contributedTotalMinor: bigint;
  currency: SupportedCurrency;
  locale?: string;
  label?: string;
  className?: string;
}

function formatAmount(
  amountMinor: bigint,
  currency: SupportedCurrency,
  locale?: string,
): string {
  return formatCurrency(amountMinor, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...(locale ? { locale } : {}),
  });
}

/**
 * Weekly plan progress: Monday–Sunday bars plus a total progressbar.
 * Bars are decorative; the visible summary and the hidden per-day list
 * carry the exact numbers, so the chart never relies on color alone.
 */
export function WeeklyPlanProgress({
  days,
  plannedTotalMinor,
  contributedTotalMinor,
  currency,
  locale,
  label = "План недели",
  className,
}: WeeklyPlanProgressProps) {
  const hasPlan = plannedTotalMinor > 0n;
  const totalPercent = hasPlan
    ? ((contributedTotalMinor * 100n) / plannedTotalMinor).toString()
    : null;
  const summary = hasPlan
    ? `Накоплено ${formatAmount(contributedTotalMinor, currency, locale)} из ${formatAmount(plannedTotalMinor, currency, locale)}${totalPercent ? ` (${totalPercent}%)` : ""}`
    : "План на неделю ещё не задан";

  return (
    <div className={classNames(styles.week, className)}>
      <div className={styles.copy}>
        <span>{label}</span>
        <strong>{totalPercent ? `${totalPercent}%` : "—"}</strong>
      </div>
      <div
        className={styles.weekDays}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Number(plannedTotalMinor)}
        aria-valuenow={Number(contributedTotalMinor)}
        aria-valuetext={summary}
      >
        {days.map((day) => {
          const dayPercent =
            hasPlan && day.plannedMinor > 0n
              ? Math.min(
                  100,
                  Number((day.contributedMinor * 100n) / day.plannedMinor),
                )
              : 0;
          const overplanned =
            day.plannedMinor > 0n && day.contributedMinor > day.plannedMinor;
          return (
            <div key={day.day} className={styles.weekDay}>
              <span className={styles.weekTrack} aria-hidden="true">
                <span
                  className={classNames(
                    styles.weekFill,
                    overplanned && styles.weekFillOver,
                  )}
                  style={{ "--week-value": `${dayPercent}%` } as CSSProperties}
                />
              </span>
              <span className={styles.weekLabel}>{day.day}</span>
            </div>
          );
        })}
      </div>
      <p className={styles.weekSummary}>{summary}</p>
      <ul className="visually-hidden">
        {days.map((day) => (
          <li key={day.day}>
            {`${day.day}: ${formatAmount(day.contributedMinor, currency, locale)} из ${formatAmount(day.plannedMinor, currency, locale)}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

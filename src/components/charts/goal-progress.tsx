import type { CSSProperties } from "react";

import type { SupportedCurrency } from "@/lib/money";
import { classNames } from "@/components/ui/class-names";

import { describeGoalProgress } from "./progress-meta";
import styles from "./chart-primitives.module.css";

export interface GoalProgressProps {
  label: string;
  savedMinor: bigint;
  targetMinor: bigint;
  currency: SupportedCurrency;
  locale?: string;
  className?: string;
}

/**
 * Linear goal progress: honest aria values (real saved vs target, never
 * clamped), a bigint-safe percent and an explicit overfunded state —
 * 0%, 100% and 100%+ are all first-class.
 */
export function GoalProgress({
  label,
  savedMinor,
  targetMinor,
  currency,
  locale,
  className,
}: GoalProgressProps) {
  const meta = describeGoalProgress({
    savedMinor,
    targetMinor,
    currency,
    locale,
  });

  return (
    <div className={classNames(styles.progressGroup, className)}>
      <div className={styles.copy}>
        <span>{label}</span>
        <strong>{meta.percentText}</strong>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Number(targetMinor)}
        aria-valuenow={Number(savedMinor)}
        aria-valuetext={meta.valueText}
      >
        <span
          className={classNames(
            styles.fill,
            meta.isOverfunded && styles.fillOverfunded,
          )}
          style={
            { "--progress-value": `${meta.cappedPercent}%` } as CSSProperties
          }
        />
      </div>
      {meta.isOverfunded && meta.surplusText ? (
        <p className={styles.overfunded}>{`+${meta.surplusText} сверх цели`}</p>
      ) : null}
    </div>
  );
}

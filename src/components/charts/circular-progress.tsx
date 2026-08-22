import type { SupportedCurrency } from "@/lib/money";

import { describeGoalProgress } from "./progress-meta";
import styles from "./chart-primitives.module.css";

export interface CircularProgressProps {
  label: string;
  savedMinor: bigint;
  targetMinor: bigint;
  currency: SupportedCurrency;
  locale?: string;
  size?: number;
  className?: string;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular goal progress: a token-colored ring whose arc never exceeds
 * the goal (overfunded goals flip the ring and read "100%+"). The svg is
 * itself the progressbar: real aria values plus an exact money valuetext.
 */
export function CircularProgress({
  label,
  savedMinor,
  targetMinor,
  currency,
  locale,
  size = 120,
  className,
}: CircularProgressProps) {
  const meta = describeGoalProgress({
    savedMinor,
    targetMinor,
    currency,
    locale,
  });
  const dash = (meta.cappedPercent / 100) * CIRCUMFERENCE;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Number(targetMinor)}
      aria-valuenow={Number(savedMinor)}
      aria-valuetext={meta.valueText}
    >
      <circle
        className={styles.ringTrack}
        cx={50}
        cy={50}
        r={RADIUS}
        strokeWidth={9}
      />
      <circle
        className={styles.ringFill}
        data-overfunded={meta.isOverfunded || undefined}
        cx={50}
        cy={50}
        r={RADIUS}
        strokeWidth={9}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE - dash}
        transform="rotate(-90 50 50)"
      />
      <text x={50} y={55} textAnchor="middle" className={styles.ringPercent}>
        {meta.percentText}
      </text>
    </svg>
  );
}

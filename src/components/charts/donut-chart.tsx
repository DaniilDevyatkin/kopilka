import type { SupportedCurrency } from "@/lib/money";
import { formatCurrency } from "@/lib/money";

import { ChartFigure, ChartLegend, type ChartTone } from "./chart-figure";
import styles from "./chart-primitives.module.css";

export interface DonutSegment {
  label: string;
  value: bigint;
}

export interface DonutChartProps {
  segments: readonly DonutSegment[];
  currency: SupportedCurrency;
  locale?: string;
  /** Visible and accessible text alternative (required). */
  summary: string;
  id?: string;
  className?: string;
}

const RADIUS = 31.83;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 1.5;

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
 * Category breakdown donut: token-colored segments in the chart palette
 * with a text-first legend (label + exact amount + percent) and a
 * required summary. The svg itself is decorative.
 */
export function DonutChart({
  segments,
  currency,
  locale,
  summary,
  id,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0n);
  const percentOf = (value: bigint): number => {
    if (total === 0n) return 0;
    const floored = (value * 100n) / total;
    return value > 0n && floored === 0n ? 1 : Number(floored);
  };

  const { arcs } = segments.reduce(
    (acc, segment, index) => {
      const percent = percentOf(segment.value);
      acc.arcs.push({
        label: segment.label,
        percent,
        tone: ((index % 5) + 1) as ChartTone,
        offset: acc.cumulative,
      });
      acc.cumulative += percent;
      return acc;
    },
    {
      cumulative: 0,
      arcs: [] as {
        label: string;
        percent: number;
        tone: ChartTone;
        offset: number;
      }[],
    },
  );

  return (
    <ChartFigure id={id} summary={summary} className={className}>
      <svg viewBox="0 0 80 80" aria-hidden="true" className={styles.donut}>
        <circle
          cx={40}
          cy={40}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={11}
        />
        {arcs.map((arc) => {
          const length = Math.max(arc.percent - GAP, 0);
          return (
            <circle
              key={arc.label}
              cx={40}
              cy={40}
              r={RADIUS}
              fill="none"
              stroke={`var(--chart-${arc.tone})`}
              strokeWidth={11}
              strokeDasharray={`${(length / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={(-arc.offset / 100) * CIRCUMFERENCE}
              transform="rotate(-90 40 40)"
            />
          );
        })}
        <text x={40} y={44} textAnchor="middle" className={styles.donutTotal}>
          {total === 0n ? "—" : formatAmount(total, currency, locale)}
        </text>
        <text x={40} y={53} textAnchor="middle" className={styles.donutCaption}>
          всего
        </text>
      </svg>
      <ChartLegend
        items={segments.map((segment, index) => ({
          label: segment.label,
          tone: arcs[index]!.tone,
          valueText: `${formatAmount(segment.value, currency, locale)} · ${percentOf(segment.value)}%`,
        }))}
      />
    </ChartFigure>
  );
}

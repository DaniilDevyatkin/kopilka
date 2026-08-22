import type { CSSProperties, ReactNode } from "react";

import { classNames } from "@/components/ui/class-names";
import styles from "./chart-primitives.module.css";

export interface ChartFigureProps {
  id?: string | undefined;
  /** Visible and accessible text alternative for the chart. */
  summary: string;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * figure + figcaption wrapper: every chart gets a text alternative by
 * construction, never meaning through color alone.
 */
export function ChartFigure({
  id,
  summary,
  children,
  className,
}: ChartFigureProps) {
  return (
    <figure id={id} className={classNames(styles.figure, className)}>
      {children}
      <figcaption>{summary}</figcaption>
    </figure>
  );
}

export type ChartTone = 1 | 2 | 3 | 4 | 5;

export interface ChartLegendItem {
  label: string;
  tone: ChartTone;
  valueText?: string;
}

export interface ChartLegendProps {
  items: readonly ChartLegendItem[];
  className?: string;
}

/**
 * Text-first legend: every entry always carries its label, so series are
 * never identified by swatch color alone.
 */
export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <ul className={classNames(styles.legend, className)}>
      {items.map((item) => (
        <li key={item.label} className={styles.legendItem}>
          <span
            className={styles.swatch}
            aria-hidden="true"
            style={{ background: `var(--chart-${item.tone})` }}
          />
          <span className={styles.legendLabel}>{item.label}</span>
          {item.valueText ? (
            <span className={styles.legendValue}>{item.valueText}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Inline style helper for progress fills driven by CSS custom properties. */
export function progressStyle(name: string, value: number): CSSProperties {
  return { [name]: `${value}%` } as CSSProperties;
}

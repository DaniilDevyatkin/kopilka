import { ChartFigure } from "./chart-figure";
import styles from "./chart-primitives.module.css";

export interface LineChartPoint {
  /** Axis label, e.g. a month name. */
  x: string;
  value: bigint;
}

export interface LineChartProps {
  points: readonly LineChartPoint[];
  /** Visible and accessible text alternative (required). */
  summary: string;
  /** Optional row of x-axis labels rendered as HTML under the svg. */
  xLabels?: readonly string[];
  id?: string;
  className?: string;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 40;
const PADDING = 2;

function yFor(value: bigint, max: bigint): number {
  if (max === 0n) return VIEW_HEIGHT - PADDING;
  const ratio = Number(value) / Number(max);
  return VIEW_HEIGHT - PADDING - ratio * (VIEW_HEIGHT - PADDING * 2);
}

/**
 * Line/area chart primitive: a 2.5:1 vector grid scaled to its container
 * with non-scaling strokes, so the line stays crisp at every width.
 * The svg is decorative; the required summary is the text alternative.
 */
export function LineChart({
  points,
  summary,
  xLabels,
  id,
  className,
}: LineChartProps) {
  const max = points.reduce(
    (top, point) => (point.value > top ? point.value : top),
    0n,
  );
  const step =
    points.length > 1 ? VIEW_WIDTH / (points.length - 1) : VIEW_WIDTH / 2;
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${step * index} ${yFor(point.value, max)}`,
    )
    .join(" ");
  const area = line
    ? `${line} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`
    : "";

  return (
    <ChartFigure id={id} summary={summary} className={className}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={styles.chartSvg}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={VIEW_WIDTH}
            y1={VIEW_HEIGHT * ratio}
            y2={VIEW_HEIGHT * ratio}
            className={styles.gridLine}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area ? <path d={area} className={styles.area} /> : null}
        {line ? (
          <path
            d={line}
            className={styles.line}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {xLabels && xLabels.length > 0 ? (
        <div className={styles.xLabels} aria-hidden="true">
          {xLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}
    </ChartFigure>
  );
}

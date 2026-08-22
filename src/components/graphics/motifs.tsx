/**
 * Shared «контур накопления» motifs: growing levels and the amber coin.
 * Token-driven, so they follow light/dark themes automatically.
 */

export function GrowthLevels({ x = 32, y = 30 }: { x?: number; y?: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y + 36}
        width={24}
        height={12}
        rx={6}
        fill="var(--accent-subtle)"
      />
      <rect
        x={x}
        y={y + 20}
        width={40}
        height={12}
        rx={6}
        fill="var(--accent-subtle)"
      />
      <rect
        x={x}
        y={y + 4}
        width={56}
        height={12}
        rx={6}
        fill="var(--accent)"
      />
    </g>
  );
}

export function Coin({
  cx = 68,
  cy = 30,
  r = 8,
}: {
  cx?: number;
  cy?: number;
  r?: number;
}) {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="var(--warning-subtle)"
        stroke="var(--warning)"
        strokeWidth={2}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.45}
        fill="var(--warning)"
        opacity={0.55}
      />
    </g>
  );
}

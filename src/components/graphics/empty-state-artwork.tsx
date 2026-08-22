import { Artwork, type ArtworkProps } from "./artwork";
import { Coin, GrowthLevels } from "./motifs";

export type EmptyStateArtworkVariant = "accounts" | "transactions" | "goals";

export interface EmptyStateArtworkProps extends Omit<
  ArtworkProps,
  "children" | "viewBox" | "title"
> {
  variant: EmptyStateArtworkVariant;
  title?: string;
}

const titles: Record<EmptyStateArtworkVariant, string> = {
  accounts: "Пока нет счетов",
  transactions: "Пока нет операций",
  goals: "Пока нет хотелок",
};

/**
 * Empty-state artwork: the container as an empty card, an empty list or
 * an empty target. Always decorative — the EmptyState copy below carries
 * the meaning.
 */
export function EmptyStateArtwork({
  variant,
  title,
  ...artworkProps
}: EmptyStateArtworkProps) {
  return (
    <Artwork title={title ?? titles[variant]} {...artworkProps}>
      {variant === "accounts" ? (
        <>
          <rect
            x={22}
            y={22}
            width={52}
            height={52}
            rx={12}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <rect
            x={32}
            y={34}
            width={22}
            height={5}
            rx={2.5}
            fill="var(--text-muted)"
          />
          <rect
            x={32}
            y={46}
            width={32}
            height={8}
            rx={4}
            fill="var(--accent-subtle)"
          />
          <rect
            x={32}
            y={60}
            width={26}
            height={5}
            rx={2.5}
            fill="var(--text-muted)"
          />
          <path
            d="M66 34v14M59 41h14"
            stroke="var(--accent)"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {variant === "transactions" ? (
        <>
          <rect
            x={22}
            y={20}
            width={52}
            height={56}
            rx={12}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <rect
            x={32}
            y={32}
            width={32}
            height={8}
            rx={4}
            fill="var(--accent-subtle)"
          />
          <rect
            x={32}
            y={46}
            width={26}
            height={8}
            rx={4}
            fill="var(--surface-sunken)"
          />
          <rect
            x={32}
            y={60}
            width={28}
            height={8}
            rx={4}
            fill="var(--surface-sunken)"
          />
          <path
            d="m42 30-5 5m5-5-5 5m10-10 4 4m0 0-4 4m4-4h-4"
            stroke="var(--positive)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M38 60v10M38 70h-8"
            stroke="var(--text-muted)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </>
      ) : null}

      {variant === "goals" ? (
        <>
          <circle
            cx={48}
            cy={44}
            r={25}
            stroke="var(--border-strong)"
            strokeWidth={5}
          />
          <circle
            cx={48}
            cy={44}
            r={25}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="2 6"
            opacity={0.5}
          />
          <GrowthLevels x={36} y={26} />
          <Coin cx={72} cy={70} r={8} />
        </>
      ) : null}
    </Artwork>
  );
}

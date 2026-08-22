import { Artwork, type ArtworkProps } from "./artwork";

export type AccountKind = "debit" | "savings" | "credit";

export interface AccountCardArtworkProps extends Omit<
  ArtworkProps,
  "children" | "viewBox" | "title"
> {
  kind: AccountKind;
  title?: string;
}

const TEXT_TOKEN: Record<AccountKind, string> = {
  debit: "var(--account-card-debit-text)",
  savings: "var(--account-card-savings-text)",
  credit: "var(--account-card-credit-text)",
};

/**
 * Decorative contour motif for account cards: concentric rounded outlines
 * in the card's own text color, so it adapts to every gradient and theme.
 * Place it inside the card; it is always aria-hidden.
 */
export function AccountCardArtwork({
  kind,
  title,
  ...artworkProps
}: AccountCardArtworkProps) {
  const ink = TEXT_TOKEN[kind];

  return (
    <Artwork title={title} viewBox="0 0 120 80" {...artworkProps}>
      <g
        stroke={`color-mix(in oklch, ${ink} 22%, transparent)`}
        strokeWidth={1.5}
      >
        <rect x={40} y={6} width={74} height={68} rx={18} />
        <rect x={50} y={14} width={62} height={52} rx={13} />
        <rect x={60} y={22} width={50} height={36} rx={9} />
      </g>
      <circle
        cx={26}
        cy={56}
        r={11}
        stroke={`color-mix(in oklch, ${ink} 30%, transparent)`}
        strokeWidth={2}
      />
      <circle
        cx={26}
        cy={56}
        r={4.5}
        fill={`color-mix(in oklch, ${ink} 26%, transparent)`}
      />
    </Artwork>
  );
}

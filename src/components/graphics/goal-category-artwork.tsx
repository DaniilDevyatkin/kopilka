import { GOAL_GLYPHS } from "@/components/icons/goal-status-glyphs";
import type { GoalIconName } from "@/components/icons/icon-names";

import { Artwork, type ArtworkProps } from "./artwork";
import { Coin } from "./motifs";

export interface GoalCategoryArtworkProps extends Omit<
  ArtworkProps,
  "children" | "viewBox" | "title"
> {
  name: GoalIconName;
  /** Outer size in CSS pixels; the artwork scales from a 96-unit grid. */
  size?: number;
  title?: string;
}

/**
 * Goal category placeholder for goal cards without an uploaded image:
 * a soft tile with the canonical 24-grid category glyph enlarged inside.
 * The glyph catalog is reused as-is, so art never drifts from icons.
 */
export function GoalCategoryArtwork({
  name,
  size = 96,
  title,
  ...artworkProps
}: GoalCategoryArtworkProps) {
  return (
    <Artwork
      title={title}
      viewBox="0 0 96 96"
      width={size}
      height={size}
      {...artworkProps}
    >
      <rect
        x={2}
        y={2}
        width={92}
        height={92}
        rx={20}
        fill="var(--surface-sunken)"
      />
      <rect
        x={6}
        y={6}
        width={84}
        height={84}
        rx={16}
        stroke="var(--border)"
        strokeWidth={1.5}
      />
      <svg
        viewBox="0 0 24 24"
        x={36}
        y={36}
        width={24}
        height={24}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GOAL_GLYPHS[name]}
      </svg>
      <Coin cx={70} cy={26} r={7} />
    </Artwork>
  );
}

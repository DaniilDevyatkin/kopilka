import { Artwork, type ArtworkProps } from "./artwork";
import { Coin } from "./motifs";

/**
 * Premium goal completion state: the target ring closed by a check,
 * with the amber coin and quiet sparkles. Decorative by default; the
 * surrounding «Цель достигнута» copy carries the meaning.
 */
export function GoalCompletionArtwork({
  title,
  ...artworkProps
}: Omit<ArtworkProps, "children" | "viewBox">) {
  return (
    <Artwork title={title} viewBox="0 0 96 96" {...artworkProps}>
      <circle
        cx={48}
        cy={48}
        r={34}
        stroke="var(--border-strong)"
        strokeWidth={3}
      />
      <circle cx={48} cy={48} r={26} stroke="var(--accent)" strokeWidth={6} />
      <path
        d="m39 48.5 6 6 12.5-13"
        stroke="var(--accent)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Coin cx={74} cy={24} r={9} />
      <path
        d="M22 26v8M18 30h8"
        stroke="var(--text-muted)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M72 70v6M69 73h6"
        stroke="var(--text-muted)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Artwork>
  );
}

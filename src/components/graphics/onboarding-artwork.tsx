import { Artwork, type ArtworkProps } from "./artwork";
import { Coin, GrowthLevels } from "./motifs";

export type OnboardingArtworkVariant =
  "welcome" | "accounts" | "income" | "goals";

export interface OnboardingArtworkProps extends Omit<
  ArtworkProps,
  "children" | "viewBox" | "title"
> {
  variant: OnboardingArtworkVariant;
  title?: string;
}

const titles: Record<OnboardingArtworkVariant, string> = {
  welcome: "Копилка встречает",
  accounts: "Первый счёт",
  income: "Доход по плану",
  goals: "Первая хотелка",
};

/**
 * Onboarding graphics: the container of savings with growing levels.
 * Decorative by default; pass a title to make the artwork semantic.
 */
export function OnboardingArtwork({
  variant,
  title,
  ...artworkProps
}: OnboardingArtworkProps) {
  return (
    <Artwork title={title ?? titles[variant]} {...artworkProps}>
      {variant === "welcome" ? (
        <>
          <rect
            x={16}
            y={12}
            width={64}
            height={72}
            rx={16}
            fill="var(--surface-sunken)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <GrowthLevels x={30} y={26} />
          <Coin cx={68} cy={72} r={9} />
        </>
      ) : null}

      {variant === "accounts" ? (
        <>
          <rect
            x={26}
            y={8}
            width={52}
            height={36}
            rx={10}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <rect
            x={34}
            y={18}
            width={22}
            height={5}
            rx={2.5}
            fill="var(--text-muted)"
          />
          <rect
            x={34}
            y={28}
            width={36}
            height={7}
            rx={3.5}
            fill="var(--accent)"
          />
          <rect
            x={18}
            y={30}
            width={52}
            height={36}
            rx={10}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <rect
            x={26}
            y={40}
            width={22}
            height={5}
            rx={2.5}
            fill="var(--text-muted)"
          />
          <rect
            x={26}
            y={50}
            width={36}
            height={7}
            rx={3.5}
            fill="var(--positive)"
          />
          <rect
            x={10}
            y={52}
            width={52}
            height={36}
            rx={10}
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <rect
            x={18}
            y={62}
            width={22}
            height={5}
            rx={2.5}
            fill="var(--text-muted)"
          />
          <rect
            x={18}
            y={72}
            width={36}
            height={7}
            rx={3.5}
            fill="var(--chart-2)"
          />
          <Coin cx={74} cy={20} r={7} />
        </>
      ) : null}

      {variant === "income" ? (
        <>
          <rect
            x={16}
            y={12}
            width={64}
            height={72}
            rx={16}
            fill="var(--surface-sunken)"
            stroke="var(--border-strong)"
            strokeWidth={2}
          />
          <GrowthLevels x={30} y={42} />
          <path
            d="M66 62v16M66 78h-16"
            stroke="var(--positive)"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <Coin cx={70} cy={24} r={8} />
        </>
      ) : null}

      {variant === "goals" ? (
        <>
          <circle
            cx={48}
            cy={44}
            r={26}
            stroke="var(--accent)"
            strokeWidth={6}
          />
          <circle
            cx={48}
            cy={44}
            r={26}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="2 6"
            opacity={0.5}
          />
          <GrowthLevels x={36} y={26} />
          <Coin cx={72} cy={72} r={9} />
        </>
      ) : null}
    </Artwork>
  );
}

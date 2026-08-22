import Image from "next/image";

export const GENERATED_ICON_NAMES = [
  "quick-income",
  "quick-expense",
  "quick-transfer",
  "quick-goal",
  "nav-home",
  "nav-cards",
  "nav-history",
  "nav-add",
  "nav-goals",
  "nav-profile",
] as const;

export type GeneratedIconName = (typeof GENERATED_ICON_NAMES)[number];

export function GeneratedIcon({
  name,
  size = 28,
  className,
}: {
  name: GeneratedIconName;
  size?: number;
  className?: string | undefined;
}) {
  return (
    <Image
      src={`/ui-icons/${name}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}

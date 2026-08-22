import type { SVGProps } from "react";

import { ICON_GLYPHS } from "./icon-glyphs";
import type { AppIconName } from "./icon-names";

export type AppIconSize = 16 | 20 | 24;

export interface AppIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  | "children"
  | "fill"
  | "height"
  | "stroke"
  | "strokeWidth"
  | "viewBox"
  | "width"
> {
  name: AppIconName;
  size?: AppIconSize;
  /** Makes the graphic semantic; omitted icons are decorative by default. */
  title?: string;
}

/**
 * Original Kopilka icon system: 24-unit grid, 1.8-unit rounded stroke and
 * currentColor inheritance. It is safe to render in Server or Client Components.
 */
export function AppIcon({
  name,
  size = 24,
  title,
  role,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...svgProps
}: AppIconProps) {
  const accessibleLabel = ariaLabel ?? title;
  const hasAccessibleName = Boolean(accessibleLabel || ariaLabelledBy);

  return (
    <svg
      {...svgProps}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      focusable="false"
      role={hasAccessibleName ? (role ?? "img") : undefined}
      aria-label={accessibleLabel}
      aria-labelledby={ariaLabelledBy}
      aria-hidden={hasAccessibleName ? undefined : true}
      data-app-icon={name}
    >
      {title ? <title>{title}</title> : null}
      {ICON_GLYPHS[name]}
    </svg>
  );
}

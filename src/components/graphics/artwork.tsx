import type { ReactNode, SVGProps } from "react";

export interface ArtworkProps extends Omit<
  SVGProps<SVGSVGElement>,
  "children" | "viewBox"
> {
  /**
   * Semantic name. Omitted artwork is decorative and hidden from
   * assistive technology; the surrounding copy carries the meaning.
   */
  title?: string | undefined;
  viewBox?: string;
  children: ReactNode;
}

/**
 * Shared shell for the «контур накопления» artwork system: local vector
 * only, currentColor-free token colors, responsive via viewBox and
 * decorative by default (aria-hidden) unless a title is provided.
 */
export function Artwork({
  title,
  viewBox = "0 0 96 96",
  children,
  role,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  ...svgProps
}: ArtworkProps) {
  const accessibleLabel = ariaLabel ?? title;
  const hasAccessibleName = Boolean(accessibleLabel || ariaLabelledBy);

  return (
    <svg
      {...svgProps}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      focusable="false"
      role={hasAccessibleName ? (role ?? "img") : undefined}
      aria-label={accessibleLabel}
      aria-labelledby={ariaLabelledBy}
      aria-hidden={hasAccessibleName ? undefined : true}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

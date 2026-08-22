import { createElement, type HTMLAttributes, type ReactNode } from "react";

import { classNames } from "./class-names";
import styles from "./ui.module.css";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "div" | "section";
  elevation?: "flat" | "raised" | "floating";
  children: ReactNode;
}

export function Surface({
  as = "div",
  elevation = "flat",
  className,
  children,
  ...surfaceProps
}: SurfaceProps) {
  return createElement(
    as,
    {
      ...surfaceProps,
      className: classNames(
        styles.surface,
        styles[`surface-${elevation}`],
        className,
      ),
    },
    children,
  );
}

export interface CardProps extends SurfaceProps {
  padding?: "compact" | "normal" | "generous";
}

export function Card({
  padding = "normal",
  className,
  ...surfaceProps
}: CardProps) {
  return (
    <Surface
      {...surfaceProps}
      className={classNames(styles.card, styles[`card-${padding}`], className)}
    />
  );
}

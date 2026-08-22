import Link from "next/link";
import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/icons";
import styles from "./app-shell.module.css";

export function RouteState({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: AppIconName;
  children?: ReactNode;
}) {
  return (
    <section className={styles.routeState} aria-labelledby="route-title">
      <span className={styles.routeIcon} aria-hidden="true">
        <AppIcon name={icon} size={24} />
      </span>
      <p className={styles.routeEyebrow}>{eyebrow}</p>
      <h1 id="route-title">{title}</h1>
      <p className={styles.routeDescription}>{description}</p>
      {children ? <div className={styles.routeActions}>{children}</div> : null}
    </section>
  );
}

export function RouteLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className={styles.routeLink} href={href}>
      {children}
      <AppIcon name="chevron" size={16} />
    </Link>
  );
}

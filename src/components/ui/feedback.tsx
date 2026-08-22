import { type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/icons";
import { classNames } from "./class-names";
import { Button } from "./button";
import styles from "./ui.module.css";

export type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({
  tone = "neutral",
  className,
  ...badgeProps
}: BadgeProps) {
  return (
    <span
      {...badgeProps}
      className={classNames(styles.badge, styles[`tone-${tone}`], className)}
    />
  );
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label: string;
  valueText: string;
}

export function Progress({
  value,
  max = 100,
  label,
  valueText,
  className,
  ...progressProps
}: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value)
    ? Math.max(0, Math.min(value, safeMax))
    : 0;
  const percent = (safeValue / safeMax) * 100;

  return (
    <div className={classNames(styles.progressGroup, className)}>
      <div className={styles.progressCopy}>
        <span>{label}</span>
        <strong>{valueText}</strong>
      </div>
      <div
        {...progressProps}
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-valuetext={valueText}
      >
        <span
          className={styles.progressFill}
          style={{ "--progress-value": `${percent}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
  variant?: "text" | "card" | "avatar";
  label?: string;
}

export function Skeleton({
  lines = 1,
  variant = "text",
  label = "Загрузка данных",
  className,
  ...skeletonProps
}: SkeletonProps) {
  const lineCount = Math.max(1, Math.min(Math.trunc(lines), 8));

  return (
    <div
      {...skeletonProps}
      className={classNames(styles.skeletonGroup, className)}
      role="status"
      aria-busy="true"
    >
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lineCount }, (_, index) => (
        <span
          className={classNames(styles.skeleton, styles[`skeleton-${variant}`])}
          key={index}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

interface StateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: AppIconName;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "savings",
  className,
  ...stateProps
}: StateProps) {
  return (
    <div
      {...stateProps}
      className={classNames(styles.state, className)}
      role="status"
    >
      <span className={styles.stateIcon} aria-hidden="true">
        <AppIcon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
  icon = "warning",
  className,
  ...stateProps
}: StateProps) {
  return (
    <div
      {...stateProps}
      className={classNames(styles.state, styles.errorState, className)}
      role="alert"
    >
      <span className={styles.stateIcon} aria-hidden="true">
        <AppIcon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}

export interface StatusMessageProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  children: ReactNode;
}

export function StatusMessage({
  tone = "neutral",
  children,
  className,
  role,
  ...messageProps
}: StatusMessageProps) {
  const icon: AppIconName =
    tone === "negative"
      ? "warning"
      : tone === "positive"
        ? "check"
        : tone === "warning"
          ? "warning"
          : "status-active";

  return (
    <div
      {...messageProps}
      className={classNames(
        styles.statusMessage,
        styles[`tone-${tone}`],
        className,
      )}
      role={role ?? (tone === "negative" ? "alert" : "status")}
    >
      <AppIcon name={icon} size={20} />
      <span>{children}</span>
    </div>
  );
}

export interface StateActionProps {
  children: ReactNode;
  onClick?: () => void;
}

export function StateAction({ children, onClick }: StateActionProps) {
  return (
    <Button variant="secondary" onClick={onClick}>
      {children}
    </Button>
  );
}

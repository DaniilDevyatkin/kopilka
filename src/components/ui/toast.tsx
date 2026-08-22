"use client";

import { type HTMLAttributes, type ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/icons";
import { IconButton } from "./button";
import { classNames } from "./class-names";
import type { Tone } from "./feedback";
import styles from "./ui.module.css";

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  children: ReactNode;
  onDismiss?: () => void;
}

export function Toast({
  tone = "neutral",
  children,
  onDismiss,
  className,
  role,
  ...toastProps
}: ToastProps) {
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
      {...toastProps}
      className={classNames(styles.toast, styles[`tone-${tone}`], className)}
      role={role ?? (tone === "negative" ? "alert" : "status")}
    >
      <AppIcon name={icon} size={20} />
      <div className={styles.toastBody}>{children}</div>
      {onDismiss ? (
        <IconButton
          className={styles.toastClose}
          label="Закрыть сообщение"
          icon="close"
          size="small"
          onClick={onDismiss}
        />
      ) : null}
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <div className={styles.toastViewport} aria-label="Уведомления">
      {children}
    </div>
  );
}

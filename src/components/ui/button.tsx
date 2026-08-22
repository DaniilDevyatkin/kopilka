import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/icons";
import { classNames } from "./class-names";
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "medium",
      pending = false,
      disabled,
      className,
      children,
      type = "button",
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        className={classNames(
          styles.button,
          styles[`button-${variant}`],
          styles[`button-${size}`],
          className,
        )}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        data-pending={pending || undefined}
      >
        {pending ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : null}
        <span className={styles.buttonLabel}>{children}</span>
      </button>
    );
  },
);

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  label: string;
  icon: AppIconName;
  variant?: ButtonVariant;
  size?: "small" | "medium";
  pending?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      icon,
      variant = "ghost",
      size = "medium",
      pending = false,
      disabled,
      className,
      type = "button",
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        className={classNames(
          styles.iconButton,
          styles[`button-${variant}`],
          styles[`iconButton-${size}`],
          className,
        )}
        disabled={disabled || pending}
        aria-label={label}
        aria-busy={pending || undefined}
        data-pending={pending || undefined}
      >
        {pending ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <AppIcon name={icon} size={size === "small" ? 16 : 20} />
        )}
      </button>
    );
  },
);

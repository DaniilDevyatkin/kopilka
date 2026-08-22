"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends Omit<ButtonProps, "type"> {
  pendingLabel?: string;
}

export function SubmitButton({
  pending: pendingOverride,
  pendingLabel,
  children,
  ...buttonProps
}: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride || formPending;

  return (
    <Button {...buttonProps} type="submit" pending={pending}>
      <span>{children}</span>
      {pending && pendingLabel ? (
        <span className="visually-hidden"> — {pendingLabel}</span>
      ) : null}
    </Button>
  );
}

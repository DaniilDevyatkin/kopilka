"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { Button, IconButton } from "./button";
import { classNames } from "./class-names";
import { getFocusableElements, lockBodyScroll } from "./overlay-manager";
import styles from "./ui.module.css";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
  /** Locks dismissal while an irreversible server action is pending. */
  dismissible?: boolean;
  closeOnBackdrop?: boolean;
  variant?: "dialog" | "sheet";
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  closeLabel = "Закрыть диалог",
  dismissible = true,
  closeOnBackdrop = true,
  variant = "dialog",
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const unlock = lockBodyScroll();
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    const focusTarget =
      initialFocusRef?.current ??
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      getFocusableElements(dialog).find(
        (element) => !element.hasAttribute("data-dialog-close"),
      ) ??
      dialog;
    focusTarget.focus();

    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      unlock();
      returnFocusRef.current?.focus();
    };
  }, [initialFocusRef, open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (dismissible) onOpenChange(false);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={classNames(styles.dialogRoot, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      data-variant={variant}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onOpenChange(false);
      }}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (
          dismissible &&
          closeOnBackdrop &&
          event.target === event.currentTarget
        ) {
          onOpenChange(false);
        }
      }}
    >
      <div className={styles.dialogPanel}>
        <header className={styles.dialogHeader}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {dismissible ? (
            <IconButton
              data-dialog-close
              label={closeLabel}
              icon="close"
              size="small"
              onClick={() => onOpenChange(false)}
            />
          ) : null}
        </header>
        {children ? <div className={styles.dialogBody}>{children}</div> : null}
        {footer ? (
          <footer className={styles.dialogFooter}>{footer}</footer>
        ) : null}
      </div>
    </dialog>
  );
}

export const AppDialog = Dialog;

export function Modal(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="dialog" />;
}

export function BottomSheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}

export interface DestructiveConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}

export function DestructiveConfirmation({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Отмена",
  pending = false,
  onConfirm,
}: DestructiveConfirmationProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      {...(pending ? {} : { initialFocusRef: cancelRef })}
      dismissible={!pending}
      closeOnBackdrop={!pending}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button variant="danger" pending={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

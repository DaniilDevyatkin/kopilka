"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { getFocusableElements } from "./overlay-manager";
import styles from "./ui.module.css";

export interface PopoverProps {
  trigger: ReactNode;
  triggerAriaLabel?: string;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function Popover({
  trigger,
  triggerAriaLabel,
  title,
  children,
  disabled = false,
  defaultOpen = false,
}: PopoverProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    (getFocusableElements(panel)[0] ?? panel).focus();

    function closeAndRestore() {
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestore();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.popover} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.popoverTrigger}
        disabled={disabled}
        aria-label={triggerAriaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className={styles.popoverPanel}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <h2 id={titleId}>{title}</h2>
          {children}
        </div>
      ) : null}
    </div>
  );
}

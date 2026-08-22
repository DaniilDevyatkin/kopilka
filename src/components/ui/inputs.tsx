import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { AppIcon } from "@/components/icons";
import { classNames } from "./class-names";
import styles from "./ui.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...inputProps },
  ref,
) {
  return (
    <input
      {...inputProps}
      ref={ref}
      className={classNames(styles.input, className)}
    />
  );
});

export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  function DateInput({ className, ...inputProps }, ref) {
    return (
      <Input
        {...inputProps}
        ref={ref}
        type="date"
        className={classNames(styles.dateInput, className)}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...textareaProps }, ref) {
  return (
    <textarea
      {...textareaProps}
      ref={ref}
      rows={rows}
      className={classNames(styles.input, styles.textarea, className)}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...selectProps }, ref) {
  return (
    <span className={styles.selectWrap}>
      <select
        {...selectProps}
        ref={ref}
        className={classNames(styles.input, styles.select, className)}
      >
        {children}
      </select>
      <AppIcon name="chevron" size={16} />
    </span>
  );
});

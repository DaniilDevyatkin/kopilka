import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

import { AppIcon } from "@/components/icons";
import styles from "./ui.module.css";

interface FieldControlProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true";
}

export interface FormFieldProps {
  label: ReactNode;
  children: ReactElement<FieldControlProps>;
  id?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

export function FormField({
  label,
  children,
  id,
  hint,
  error,
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  if (!isValidElement(children)) {
    throw new Error("FormField requires exactly one form control element.");
  }

  const existingDescription = children.props["aria-describedby"];
  const describedBy = [existingDescription, hintId, errorId]
    .filter(Boolean)
    .join(" ");
  const injectedProps: FieldControlProps = {
    id: children.props.id ?? controlId,
  };
  if (describedBy) injectedProps["aria-describedby"] = describedBy;
  if (error) injectedProps["aria-invalid"] = true;
  else if (children.props["aria-invalid"] !== undefined) {
    injectedProps["aria-invalid"] = children.props["aria-invalid"];
  }
  const control = cloneElement(children, injectedProps);

  return (
    <div className={styles.formField}>
      <label
        className={styles.fieldLabel}
        htmlFor={children.props.id ?? controlId}
      >
        {label}
        {required ? (
          <>
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
            <span className="visually-hidden">, обязательное поле</span>
          </>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          <AppIcon name="warning" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

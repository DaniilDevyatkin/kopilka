import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { classNames } from "./class-names";
import styles from "./ui.module.css";

interface ChoiceProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "type"
> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(
  function Checkbox({ label, description, className, id, ...inputProps }, ref) {
    const generatedId = useId();
    const controlId = id ?? `checkbox-${generatedId.replaceAll(":", "")}`;
    const descriptionId = description ? `${controlId}-description` : undefined;

    return (
      <label
        className={classNames(styles.choice, className)}
        htmlFor={controlId}
      >
        <input
          {...inputProps}
          ref={ref}
          id={controlId}
          type="checkbox"
          className={styles.nativeChoice}
          aria-describedby={descriptionId}
        />
        <span className={styles.checkboxVisual} aria-hidden="true" />
        <span className={styles.choiceCopy}>
          <strong>{label}</strong>
          {description ? <span id={descriptionId}>{description}</span> : null}
        </span>
      </label>
    );
  },
);

export const Switch = forwardRef<HTMLInputElement, ChoiceProps>(function Switch(
  { label, description, className, id, ...inputProps },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? `switch-${generatedId.replaceAll(":", "")}`;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <label className={classNames(styles.choice, className)} htmlFor={controlId}>
      <input
        {...inputProps}
        ref={ref}
        id={controlId}
        type="checkbox"
        role="switch"
        className={styles.nativeChoice}
        aria-describedby={descriptionId}
      />
      <span className={styles.switchVisual} aria-hidden="true">
        <span />
      </span>
      <span className={styles.choiceCopy}>
        <strong>{label}</strong>
        {description ? <span id={descriptionId}>{description}</span> : null}
      </span>
    </label>
  );
});

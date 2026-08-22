"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { IconButton } from "./button";
import { classNames } from "./class-names";
import { Input } from "./inputs";
import styles from "./ui.module.css";

export type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...inputProps }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <span className={styles.inputAffixWrap}>
        <Input
          {...inputProps}
          ref={ref}
          type={visible ? "text" : "password"}
          className={classNames(styles.inputWithAction, className)}
        />
        <IconButton
          className={styles.inputAction}
          size="small"
          icon={visible ? "eye-off" : "eye"}
          label={visible ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        />
      </span>
    );
  },
);

"use client";

import {
  forwardRef,
  useState,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";

import {
  formatCurrency,
  parseMoney,
  serializeMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { classNames } from "./class-names";
import { Input } from "./inputs";
import styles from "./ui.module.css";

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "inputMode" | "onBlur" | "onChange" | "type" | "value"
> {
  currency?: SupportedCurrency;
  locale?: string;
  allowNegative?: boolean;
  defaultValue?: string;
  onValueChange?: (minorUnits: SerializedMoney | null) => void;
  onValidityChange?: (valid: boolean) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      currency = "RUB",
      locale = "ru-RU",
      allowNegative = false,
      defaultValue = "",
      onValueChange,
      onValidityChange,
      onBlur,
      className,
      "aria-invalid": ariaInvalid,
      ...inputProps
    },
    ref,
  ) {
    const [displayValue, setDisplayValue] = useState(defaultValue);
    const [invalid, setInvalid] = useState(false);

    function validate(value: string): bigint | null {
      if (value.trim() === "") {
        setInvalid(false);
        onValidityChange?.(true);
        onValueChange?.(null);
        return null;
      }

      try {
        const minorUnits = parseMoney(value, {
          currency,
          locale,
          allowNegative,
        });
        setInvalid(false);
        onValidityChange?.(true);
        onValueChange?.(serializeMoney(minorUnits));
        return minorUnits;
      } catch {
        onValidityChange?.(false);
        return null;
      }
    }

    return (
      <Input
        {...inputProps}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        className={classNames(styles.moneyInput, className)}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDisplayValue(nextValue);
          validate(nextValue);
        }}
        onBlur={(event) => {
          const minorUnits = validate(event.currentTarget.value);
          if (event.currentTarget.value.trim() !== "" && minorUnits === null) {
            setInvalid(true);
          } else if (minorUnits !== null) {
            setDisplayValue(
              formatCurrency(minorUnits, currency, {
                locale,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
            );
          }
          onBlur?.(event);
        }}
      />
    );
  },
);

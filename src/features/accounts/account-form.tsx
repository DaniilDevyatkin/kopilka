"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import {
  FormField,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
} from "@/components/ui";
import {
  ACCOUNT_TYPE_OPTIONS,
  CARD_THEMES,
  normalizeCardTheme,
} from "@/lib/accounts/catalog";
import type { ClientAccount } from "@/lib/accounts/dto";
import {
  deserializeMoney,
  formatCurrency,
  parseMoney,
  type SupportedCurrency,
} from "@/lib/money";
import type { AccountsActionResult } from "@/server/actions/accounts";
import type { AccountType } from "@/generated/prisma/client";
import styles from "./accounts.module.css";

export type AccountCreateFormInput = {
  name: string;
  type: AccountType;
  currency: SupportedCurrency;
  visualTheme: string;
  imageAssetId?: string;
  creditLimitMinor?: bigint;
  openingBalanceMinor: bigint;
  idempotencyKey: string;
};

export type AccountUpdateFormInput = {
  accountId: string;
  name: string;
  visualTheme: string;
  imageAssetId?: string | null;
  last4?: string | null;
  creditLimitMinor?: bigint | null;
};

interface AccountFormErrors {
  name?: string;
  creditLimitMinor?: string;
  openingBalanceMinor?: string;
}

interface AccountFormState {
  attempt: number;
  result?: {
    ok: boolean;
    code: string;
    message: string;
    fieldErrors?: AccountFormErrors;
  };
}

const INITIAL_STATE: AccountFormState = { attempt: 0 };

const NETWORK_FAILURE = {
  ok: false,
  code: "INVALID_INPUT",
  message:
    "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
};

function parseOptional(
  raw: string,
  currency: SupportedCurrency,
): bigint | null {
  if (raw.trim() === "") return null;
  try {
    return parseMoney(raw, { currency, locale: "ru-RU" });
  } catch {
    return null;
  }
}

export function AccountForm({
  mode,
  baseCurrency = "RUB",
  initial,
  successPath,
  submitCreate,
  submitUpdate,
}: {
  mode: "create" | "edit";
  baseCurrency?: SupportedCurrency;
  initial?: ClientAccount;
  successPath: string;
  submitCreate?: (
    input: AccountCreateFormInput,
  ) => Promise<AccountsActionResult<ClientAccount>>;
  submitUpdate?: (
    input: AccountUpdateFormInput,
  ) => Promise<AccountsActionResult<ClientAccount>>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<AccountType>(initial?.type ?? "DEBIT_CARD");
  const [currency] = useState<SupportedCurrency>(
    (initial?.currency as SupportedCurrency) ?? baseCurrency,
  );
  const initialTheme = normalizeCardTheme(
    initial?.visualTheme ?? CARD_THEMES[0].value,
  );
  const [visualTheme, setVisualTheme] = useState(initialTheme);
  const [imageAssetId, setImageAssetId] = useState<string | null>(
    initial?.imageAssetId ?? null,
  );
  const [uploadPreview, setUploadPreview] = useState<string | null>(
    initial?.imageAssetId
      ? `/api/accounts/images/${initial.imageAssetId}`
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isCredit = type === "CREDIT_CARD";

  async function discardTemporaryImage(assetId: string | null) {
    if (!assetId || assetId === initial?.imageAssetId) return;
    await fetch(`/api/accounts/images/${assetId}`, { method: "DELETE" }).catch(
      () => {},
    );
  }

  const [state, formAction, pending] = useActionState(
    async (
      previous: AccountFormState,
      formData: FormData,
    ): Promise<AccountFormState> => {
      const name = String(formData.get("name") ?? "");
      const openingRaw = String(formData.get("openingBalanceMinor") ?? "");
      const creditRaw = String(formData.get("creditLimitMinor") ?? "");
      const nextCurrency: SupportedCurrency =
        mode === "create"
          ? (String(formData.get("currency") ?? "RUB") as SupportedCurrency)
          : currency;

      const fieldErrors: AccountFormErrors = {};
      if (name.trim() === "") fieldErrors.name = "Укажите название счёта.";
      if (
        isCredit &&
        creditRaw.trim() !== "" &&
        parseOptional(creditRaw, nextCurrency) === null
      ) {
        fieldErrors.creditLimitMinor = "Неверная сумма лимита.";
      }
      if (mode === "create") {
        if (openingRaw.trim() === "") {
          fieldErrors.openingBalanceMinor = "Укажите начальный баланс.";
        } else if (parseOptional(openingRaw, nextCurrency) === null) {
          fieldErrors.openingBalanceMinor = "Неверная сумма.";
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        return {
          attempt: previous.attempt + 1,
          result: {
            ok: false,
            code: "INVALID_INPUT",
            message: "Проверьте выделенные поля.",
            fieldErrors,
          },
        };
      }

      if (mode === "create") {
        const action = submitCreate;
        if (!action)
          throw new Error("AccountForm create mode requires submitCreate.");
        const inputValue: AccountCreateFormInput = {
          name: name.trim(),
          type,
          currency: nextCurrency,
          visualTheme,
          ...(imageAssetId ? { imageAssetId } : {}),
          openingBalanceMinor: parseOptional(openingRaw, nextCurrency) ?? 0n,
          idempotencyKey: crypto.randomUUID(),
        };
        if (isCredit && creditRaw.trim() !== "") {
          inputValue.creditLimitMinor =
            parseOptional(creditRaw, nextCurrency) ?? 0n;
        }
        try {
          const result = await action(inputValue);
          if (result.ok) {
            router.replace(successPath);
            router.refresh();
          }
          return {
            attempt: previous.attempt + 1,
            result: {
              ok: result.ok,
              code: result.ok ? "" : result.code,
              message: result.ok ? "" : result.message,
            },
          };
        } catch {
          return { attempt: previous.attempt + 1, result: NETWORK_FAILURE };
        }
      }

      const action = submitUpdate;
      if (!action)
        throw new Error("AccountForm edit mode requires submitUpdate.");
      if (!initial) throw new Error("AccountForm edit mode requires initial.");
      const inputValue: AccountUpdateFormInput = {
        accountId: initial.id,
        name: name.trim(),
        visualTheme,
        imageAssetId,
      };
      if (isCredit) {
        inputValue.creditLimitMinor =
          creditRaw.trim() === "" ? null : parseOptional(creditRaw, currency);
      }
      try {
        const result = await action(inputValue);
        if (result.ok) {
          router.replace(successPath);
          router.refresh();
        }
        return {
          attempt: previous.attempt + 1,
          result: {
            ok: result.ok,
            code: result.ok ? "" : result.code,
            message: result.ok ? "" : result.message,
          },
        };
      } catch {
        return { attempt: previous.attempt + 1, result: NETWORK_FAILURE };
      }
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (!state.result || state.result.ok || !state.result.fieldErrors) return;
    formRef.current
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  }, [state.attempt, state.result]);

  const result = state.result;
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className={styles.form} noValidate>
      <FormField
        label="Название"
        hint="Например: Зарплатная карта, Наличные на жизнь."
        error={fieldErrors?.name}
        required
      >
        <Input
          name="name"
          defaultValue={initial?.name}
          maxLength={120}
          autoComplete="off"
          required
        />
      </FormField>

      {mode === "create" ? (
        <div className={styles.formColumns}>
          <FormField label="Тип счёта" required>
            <Select
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as AccountType)}
            >
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Валюта"
            hint="Совпадает с базовой валютой профиля."
            required
          >
            <Input
              name="currency"
              value={currency}
              readOnly
              aria-readonly="true"
            />
          </FormField>
        </div>
      ) : null}

      <fieldset className={styles.themeGroup}>
        <legend>Дизайн карты</legend>
        <div className={styles.themeOptions}>
          {CARD_THEMES.map((theme) => (
            <label className={styles.themeOption} key={theme.value}>
              <input
                type="radio"
                name="visualTheme"
                value={theme.value}
                checked={!imageAssetId && visualTheme === theme.value}
                onChange={() => {
                  void discardTemporaryImage(imageAssetId);
                  setVisualTheme(theme.value);
                  setImageAssetId(null);
                  setUploadPreview(null);
                }}
              />
              <span className={styles.themeSwatch}>
                <Image
                  src={theme.src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 42vw, 180px"
                />
              </span>
              <span className={styles.themeLabel}>{theme.label}</span>
            </label>
          ))}
          <label className={`${styles.themeOption} ${styles.uploadTheme}`}>
            <input
              type="file"
              name="customCardImage"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                setUploading(true);
                setUploadError(null);
                const preview = URL.createObjectURL(file);
                try {
                  const body = new FormData();
                  body.set("file", file);
                  const response = await fetch("/api/accounts/images", {
                    method: "POST",
                    body,
                  });
                  const result = (await response.json()) as {
                    id?: string;
                    message?: string;
                  };
                  if (!response.ok || !result.id)
                    throw new Error(
                      result.message ?? "Не удалось загрузить изображение.",
                    );
                  await discardTemporaryImage(imageAssetId);
                  setImageAssetId(result.id);
                  setUploadPreview(preview);
                } catch (error) {
                  URL.revokeObjectURL(preview);
                  setUploadError(
                    error instanceof Error
                      ? error.message
                      : "Не удалось загрузить изображение.",
                  );
                } finally {
                  setUploading(false);
                }
              }}
            />
            <span className={styles.themeSwatch}>
              {uploadPreview ? (
                <Image
                  src={uploadPreview}
                  alt=""
                  fill
                  unoptimized
                  sizes="180px"
                />
              ) : (
                <span className={styles.uploadPlaceholder}>
                  +<small>Своя картинка</small>
                </span>
              )}
            </span>
            <span className={styles.themeLabel}>
              {uploading ? "Загружаем…" : "Загрузить свою"}
            </span>
          </label>
        </div>
        {uploadError ? (
          <p className={styles.formError} role="alert">
            {uploadError}
          </p>
        ) : null}
      </fieldset>

      {isCredit ? (
        <FormField
          label="Кредитный лимит"
          hint={
            mode === "edit"
              ? "Оставьте пустым, чтобы убрать лимит."
              : "Например: 100 000."
          }
          error={fieldErrors?.creditLimitMinor}
        >
          <MoneyInput
            name="creditLimitMinor"
            currency={currency}
            allowNegative={false}
            defaultValue={
              mode === "edit" && initial?.creditLimitMinor
                ? formatCurrency(
                    deserializeMoney(initial.creditLimitMinor),
                    currency,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )
                : ""
            }
          />
        </FormField>
      ) : null}

      {mode === "create" ? (
        <FormField
          label="Начальный баланс"
          hint={
            isCredit
              ? "Укажите текущий долг со знаком минус, если он есть."
              : "Сколько денег на счёте сейчас."
          }
          error={fieldErrors?.openingBalanceMinor}
          required
        >
          <MoneyInput
            name="openingBalanceMinor"
            currency={currency}
            allowNegative={isCredit}
            defaultValue="0"
          />
        </FormField>
      ) : null}

      {result && !result.ok ? (
        <p className={styles.formError} role="alert">
          {result.message}
        </p>
      ) : null}

      <div className={styles.formActions}>
        <SubmitButton
          className={styles.actionButton}
          pending={pending}
          pendingLabel={mode === "create" ? "Создаём счёт" : "Сохраняем"}
        >
          {mode === "create" ? "Создать счёт" : "Сохранить изменения"}
        </SubmitButton>
        <Link
          className={styles.cancelLink}
          href={successPath}
          aria-disabled={pending}
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}

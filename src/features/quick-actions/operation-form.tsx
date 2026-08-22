"use client";

import { useState } from "react";
import { useActionState } from "react";

import {
  Button,
  FormField,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
} from "@/components/ui";
import type { ClientAccount } from "@/lib/accounts/dto";
import {
  deserializeMoney,
  serializeMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import {
  INITIAL_MUTATION_STATE,
  NETWORK_FAILURE_RESULT,
  datetimeLocalNow,
  parseDatetimeLocal,
  toFormResult,
  type MutationFieldErrors,
  type MutationFormState,
} from "@/lib/operations/form-state";
import type { OperationActionResult } from "@/server/actions/operations";
import type { CategoryReadModel } from "@/server/categories/service";
import type {
  CreateOperationInput,
  CreateOperationResult,
} from "@/server/operations/service";
import styles from "./quick-actions.module.css";

const KIND_LABEL: Record<"INCOME" | "EXPENSE", string> = {
  INCOME: "Доход",
  EXPENSE: "Расход",
};

export function OperationForm({
  kind,
  accounts,
  categories,
  submit,
  onSuccess,
  onCancel,
}: {
  kind: "INCOME" | "EXPENSE";
  accounts: ClientAccount[];
  categories: CategoryReadModel[];
  submit: (
    input: CreateOperationInput,
  ) => Promise<OperationActionResult<CreateOperationResult>>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amountMinor, setAmountMinor] = useState<SerializedMoney | null>(null);
  const [amountPreset, setAmountPreset] = useState<{
    value: string;
    key: number;
  }>({ value: "", key: 0 });

  const currency: SupportedCurrency =
    (accounts.find((account) => account.id === accountId)?.currency as
      SupportedCurrency | undefined) ?? "RUB";

  const [state, formAction, pending] = useActionState(
    async (
      previous: MutationFormState,
      formData: FormData,
    ): Promise<MutationFormState> => {
      const comment = String(formData.get("comment") ?? "");
      const occurredAtRaw = String(formData.get("occurredAt") ?? "");

      const fieldErrors: MutationFieldErrors = {};
      if (amountMinor === null) {
        fieldErrors.amountMinor = "Введите сумму.";
      }
      if (accountId === "") fieldErrors.accountId = "Выберите счёт.";
      if (categoryId === "") fieldErrors.categoryId = "Выберите категорию.";
      if (occurredAtRaw.trim() === "") {
        fieldErrors.occurredAt = "Укажите дату и время.";
      } else if (parseDatetimeLocal(occurredAtRaw) === null) {
        fieldErrors.occurredAt = "Неверная дата.";
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

      try {
        const result = await submit({
          kind,
          amountMinor: deserializeMoney(amountMinor!),
          accountId,
          categoryId,
          comment: comment.trim() === "" ? undefined : comment.trim(),
          occurredAt: parseDatetimeLocal(occurredAtRaw) ?? "",
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.ok) {
          onSuccess();
          return { attempt: previous.attempt + 1 };
        }
        return {
          attempt: previous.attempt + 1,
          result: toFormResult(result),
        };
      } catch {
        return {
          attempt: previous.attempt + 1,
          result: NETWORK_FAILURE_RESULT,
        };
      }
    },
    INITIAL_MUTATION_STATE,
  );

  const result = state.result;
  const fieldErrors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <form action={formAction} className={styles.form} noValidate>
      <FormField label="Сумма" error={fieldErrors?.amountMinor} required>
        <MoneyInput
          key={`${accountId}-${amountPreset.key}`}
          name="amountMinor"
          currency={currency}
          defaultValue={amountPreset.value}
          allowNegative={false}
          onValueChange={setAmountMinor}
          data-testid="operation-amount"
        />
      </FormField>
      <div className={styles.amountPresets} aria-label="Быстрый выбор суммы">
        {[500, 1000, 2000].map((value) => (
          <Button
            key={value}
            size="small"
            variant="ghost"
            onClick={() => {
              setAmountMinor(serializeMoney(BigInt(value) * 100n));
              setAmountPreset({
                value: String(value),
                key: amountPreset.key + 1,
              });
            }}
          >
            +{value.toLocaleString("ru-RU")} ₽
          </Button>
        ))}
      </div>

      <FormField label="Счёт" error={fieldErrors?.accountId} required>
        <Select
          name="accountId"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setAmountMinor(null);
            setAmountPreset({ value: "", key: amountPreset.key + 1 });
          }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Категория" error={fieldErrors?.categoryId} required>
        <Select
          name="categoryId"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelRu}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Комментарий" hint="Необязательно">
        <Input
          name="comment"
          maxLength={500}
          autoComplete="off"
          placeholder={KIND_LABEL[kind]}
        />
      </FormField>

      <FormField label="Дата и время" error={fieldErrors?.occurredAt} required>
        <Input
          type="datetime-local"
          name="occurredAt"
          defaultValue={datetimeLocalNow()}
          max={datetimeLocalNow()}
        />
      </FormField>

      {result && !result.ok ? (
        <p className={styles.formError} role="alert">
          {result.message}
        </p>
      ) : null}

      <div className={styles.formActions}>
        <SubmitButton pending={pending} pendingLabel="Сохраняем">
          {kind === "INCOME" ? "Добавить доход" : "Добавить расход"}
        </SubmitButton>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

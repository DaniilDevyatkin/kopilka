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
import type { TransferActionResult } from "@/server/actions/transfers";
import type {
  CreateTransferInput,
  CreateTransferResult,
} from "@/server/transfers/service";
import styles from "./quick-actions.module.css";

export function TransferForm({
  accounts,
  submit,
  onSuccess,
  onCancel,
}: {
  accounts: ClientAccount[];
  submit: (
    input: CreateTransferInput,
  ) => Promise<TransferActionResult<CreateTransferResult>>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? "",
  );
  const [amountMinor, setAmountMinor] = useState<SerializedMoney | null>(null);

  const currency: SupportedCurrency =
    (accounts.find((account) => account.id === sourceAccountId)?.currency as
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
      if (sourceAccountId === "") {
        fieldErrors.sourceAccountId = "Выберите счёт списания.";
      }
      if (destinationAccountId === "") {
        fieldErrors.destinationAccountId = "Выберите счёт зачисления.";
      } else if (destinationAccountId === sourceAccountId) {
        fieldErrors.destinationAccountId =
          "Выберите разные счета для перевода.";
      }
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
          amountMinor: deserializeMoney(amountMinor!),
          sourceAccountId,
          destinationAccountId,
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
          key={sourceAccountId}
          name="amountMinor"
          currency={currency}
          allowNegative={false}
          onValueChange={setAmountMinor}
          data-testid="transfer-amount"
        />
      </FormField>

      <FormField label="Со счёта" error={fieldErrors?.sourceAccountId} required>
        <Select
          name="sourceAccountId"
          value={sourceAccountId}
          onChange={(event) => {
            const next = event.target.value;
            setSourceAccountId(next);
            if (next === destinationAccountId) setDestinationAccountId("");
          }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.currency}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="На счёт"
        error={fieldErrors?.destinationAccountId}
        required
      >
        <Select
          name="destinationAccountId"
          value={destinationAccountId}
          onChange={(event) => setDestinationAccountId(event.target.value)}
        >
          <option value="" disabled>
            Выберите счёт…
          </option>
          {accounts
            .filter((account) => account.id !== sourceAccountId)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
        </Select>
      </FormField>

      <FormField label="Комментарий" hint="Необязательно">
        <Input
          name="comment"
          maxLength={500}
          autoComplete="off"
          placeholder="Например: на накопления"
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
        <SubmitButton pending={pending} pendingLabel="Переводим">
          Перевести
        </SubmitButton>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

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
import type { GoalActionResult } from "@/server/actions/goals";
import type {
  ContributeGoalInput,
  GoalReadModel,
  ReserveMutationResult,
} from "@/server/goals/service";
import styles from "./quick-actions.module.css";

export function ContributeForm({
  goals,
  accounts,
  submit,
  onSuccess,
  onCancel,
}: {
  goals: GoalReadModel[];
  accounts: ClientAccount[];
  submit: (
    input: ContributeGoalInput,
  ) => Promise<GoalActionResult<ReserveMutationResult>>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [amountMinor, setAmountMinor] = useState<SerializedMoney | null>(null);
  const [amountPreset, setAmountPreset] = useState<{
    value: string;
    key: number;
  }>({ value: "", key: 0 });

  const currency: SupportedCurrency =
    (accounts.find((account) => account.id === sourceAccountId)?.currency as
      SupportedCurrency | undefined) ?? "RUB";

  const [state, formAction, pending] = useActionState(
    async (
      previous: MutationFormState,
      formData: FormData,
    ): Promise<MutationFormState> => {
      const note = String(formData.get("note") ?? "");
      const occurredAtRaw = String(formData.get("occurredAt") ?? "");

      const fieldErrors: MutationFieldErrors = {};
      if (amountMinor === null) {
        fieldErrors.amountMinor = "Введите сумму.";
      }
      if (goalId === "") fieldErrors.goalId = "Выберите хотелку.";
      if (sourceAccountId === "") {
        fieldErrors.sourceAccountId = "Выберите счёт списания.";
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
          goalId,
          sourceAccountId,
          amountMinor: deserializeMoney(amountMinor!),
          note: note.trim() === "" ? undefined : note.trim(),
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
      <FormField label="Хотелка" error={fieldErrors?.goalId} required>
        <Select
          name="goalId"
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
        >
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Сумма" error={fieldErrors?.amountMinor} required>
        <MoneyInput
          key={`${sourceAccountId}-${amountPreset.key}`}
          name="amountMinor"
          currency={currency}
          defaultValue={amountPreset.value}
          allowNegative={false}
          onValueChange={setAmountMinor}
          data-testid="contribute-amount"
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

      <FormField label="Со счёта" error={fieldErrors?.sourceAccountId} required>
        <Select
          name="sourceAccountId"
          value={sourceAccountId}
          onChange={(event) => {
            setSourceAccountId(event.target.value);
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

      <FormField label="Комментарий" hint="Необязательно">
        <Input
          name="note"
          maxLength={500}
          autoComplete="off"
          placeholder="Например: первая часть"
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
        <SubmitButton pending={pending} pendingLabel="Пополняем">
          Пополнить хотелку
        </SubmitButton>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

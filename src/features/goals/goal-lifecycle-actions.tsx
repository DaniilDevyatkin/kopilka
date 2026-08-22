"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Button,
  Dialog,
  FormField,
  MoneyInput,
  Select,
  SubmitButton,
} from "@/components/ui";
import {
  formatMoney,
  serializeMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { completeGoalAction, withdrawGoalAction } from "@/server/actions/goals";
import styles from "./goals.module.css";

interface AccountOption {
  id: string;
  name: string;
}

export function GoalLifecycleActions({
  goalId,
  targetAmountMinor,
  reservedAmountMinor,
  currency,
  accounts,
}: {
  goalId: string;
  targetAmountMinor: bigint;
  reservedAmountMinor: bigint;
  currency: SupportedCurrency;
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"withdraw" | "complete" | null>(null);
  const [amount, setAmount] = useState<SerializedMoney | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(formData: FormData) {
    if (!amount || BigInt(amount) <= 0n) {
      setMessage("Укажите положительную сумму.");
      return;
    }
    const accountId = String(formData.get("accountId") ?? "");
    if (!accountId) {
      setMessage("Выберите карту.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const common = {
        goalId,
        occurredAt: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      };
      const result =
        mode === "withdraw"
          ? await withdrawGoalAction({
              ...common,
              sourceAccountId: accountId,
              amountMinor: BigInt(amount),
            })
          : await completeGoalAction({
              ...common,
              paymentAccountId: accountId,
              actualPurchaseAmountMinor: BigInt(amount),
            });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className={styles.goalActions}>
        {reservedAmountMinor > 0n ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAmount(serializeMoney(reservedAmountMinor));
              setMode("withdraw");
            }}
          >
            Вернуть из резерва
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => {
            setAmount(serializeMoney(targetAmountMinor));
            setMode("complete");
          }}
        >
          Завершить покупкой
        </Button>
      </div>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => !open && setMode(null)}
        title={mode === "withdraw" ? "Вернуть деньги" : "Завершить хотелку"}
        description={
          mode === "withdraw"
            ? "Резерв уменьшится, капитал не изменится."
            : "Резерв будет снят, а покупка записана одним расходом."
        }
        variant="sheet"
      >
        <form action={submit} className={styles.form} noValidate>
          <FormField label="Карта" required>
            <Select
              name="accountId"
              defaultValue={accounts[0]?.id ?? ""}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={mode === "withdraw" ? "Сумма возврата" : "Стоимость покупки"}
            required
          >
            <MoneyInput
              name="amount"
              currency={currency}
              defaultValue={formatMoney(
                mode === "withdraw" ? reservedAmountMinor : targetAmountMinor,
              )}
              onValueChange={setAmount}
              required
            />
          </FormField>
          {message ? <p role="alert">{message}</p> : null}
          <div className={styles.formFooter}>
            <SubmitButton pending={pending} pendingLabel="Сохраняем">
              {mode === "withdraw" ? "Вернуть" : "Подтвердить покупку"}
            </SubmitButton>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setMode(null)}
            >
              Отмена
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

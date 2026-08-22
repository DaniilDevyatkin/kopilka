"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  DestructiveConfirmation,
  Dialog,
  FormField,
  Input,
  MoneyInput,
  Select,
} from "@/components/ui";
import {
  deserializeMoney,
  formatMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import {
  parseDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/operations/form-state";
import {
  cancelOperationAction,
  editOperationAction,
} from "@/server/actions/operations";
import styles from "./finance.module.css";

export function OperationLifecycleActions({
  operation,
  accounts,
  categories,
}: {
  operation: {
    id: string;
    kind: "INCOME" | "EXPENSE";
    amountMinor: SerializedMoney;
    accountId: string;
    categoryId: string;
    note: string | null;
    occurredAt: string;
    currency: SupportedCurrency;
  };
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<SerializedMoney | null>(
    operation.amountMinor,
  );

  async function edit(formData: FormData) {
    if (!amount) {
      setMessage("Введите сумму.");
      return;
    }
    const occurredAt = parseDatetimeLocal(
      String(formData.get("occurredAt") ?? ""),
    );
    if (!occurredAt) {
      setMessage("Проверьте дату.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await editOperationAction({
        operationId: operation.id,
        kind: operation.kind,
        amountMinor: deserializeMoney(amount),
        accountId: String(formData.get("accountId") ?? ""),
        categoryId: String(formData.get("categoryId") ?? ""),
        comment: String(formData.get("comment") ?? "").trim() || undefined,
        occurredAt,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setEditOpen(false);
      router.push(`/app/transactions/${result.data.operation.id}`);
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером.");
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setPending(true);
    setMessage(null);
    try {
      const result = await cancelOperationAction({
        operationId: operation.id,
        occurredAt: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) setMessage(result.message);
      setCancelOpen(false);
      router.refresh();
    } catch {
      setMessage("Нет связи с сервером.");
      setCancelOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.lifecyclePanel}
      aria-labelledby="operation-actions-title"
    >
      <h2 id="operation-actions-title">Управление операцией</h2>
      {message ? (
        <p className={styles.formError} role="alert">
          {message}
        </p>
      ) : null}
      <div className={styles.lifecycleButtons}>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          Изменить
        </Button>
        <Button variant="danger" onClick={() => setCancelOpen(true)}>
          Отменить
        </Button>
      </div>
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={`Изменить ${operation.kind === "INCOME" ? "доход" : "расход"}`}
        description="Старая запись будет компенсирована, исправленная — сохранена новой операцией."
        dismissible={!pending}
      >
        <form action={edit} className={styles.editForm}>
          <FormField label="Сумма" required>
            <MoneyInput
              currency={operation.currency}
              defaultValue={formatMoney(
                deserializeMoney(operation.amountMinor),
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )}
              onValueChange={setAmount}
            />
          </FormField>
          <FormField label="Карта" required>
            <Select name="accountId" defaultValue={operation.accountId}>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Категория" required>
            <Select name="categoryId" defaultValue={operation.categoryId}>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Комментарий">
            <Input
              name="comment"
              defaultValue={operation.note ?? ""}
              maxLength={500}
            />
          </FormField>
          <FormField label="Дата и время" required>
            <Input
              name="occurredAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(new Date(operation.occurredAt))}
            />
          </FormField>
          {message ? (
            <p className={styles.formError} role="alert">
              {message}
            </p>
          ) : null}
          <div className={styles.lifecycleButtons}>
            <Button type="submit" pending={pending}>
              Сохранить
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setEditOpen(false)}
            >
              Закрыть
            </Button>
          </div>
        </form>
      </Dialog>
      <DestructiveConfirmation
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Отменить операцию?"
        description={
          operation.kind === "INCOME"
            ? "Доход будет компенсирован. Отмена невозможна, если эти средства уже потрачены или зарезервированы."
            : "Расход будет компенсирован, а сумма вернётся на карту."
        }
        confirmLabel="Отменить операцию"
        pending={pending}
        onConfirm={cancel}
      />
    </section>
  );
}

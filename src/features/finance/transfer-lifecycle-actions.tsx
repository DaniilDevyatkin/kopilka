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
} from "@/lib/money";
import {
  parseDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/operations/form-state";
import {
  cancelTransferAction,
  editTransferAction,
} from "@/server/actions/transfers";
import styles from "./finance.module.css";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

export function TransferLifecycleActions({
  transferId,
  amountMinor,
  sourceAccountId,
  destinationAccountId,
  note,
  occurredAt,
  accounts,
}: {
  transferId: string;
  amountMinor: SerializedMoney;
  sourceAccountId: string;
  destinationAccountId: string;
  note: string | null;
  occurredAt: string;
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState(sourceAccountId);
  const [destination, setDestination] = useState(destinationAccountId);
  const [amount, setAmount] = useState<SerializedMoney | null>(amountMinor);

  async function edit(formData: FormData) {
    setError(null);
    if (!amount || source === destination) {
      setError(
        source === destination ? "Выберите разные карты." : "Введите сумму.",
      );
      return;
    }
    const occurredAtValue = parseDatetimeLocal(
      String(formData.get("occurredAt") ?? ""),
    );
    if (!occurredAtValue) {
      setError("Проверьте дату операции.");
      return;
    }
    setPending(true);
    try {
      const result = await editTransferAction({
        transferId,
        amountMinor: deserializeMoney(amount),
        sourceAccountId: source,
        destinationAccountId: destination,
        comment: String(formData.get("comment") ?? "").trim() || undefined,
        occurredAt: occurredAtValue,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditOpen(false);
      router.push(`/app/transactions/${result.data.transfer.id}`);
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const result = await cancelTransferAction({
        transferId,
        occurredAt: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.message);
        setCancelOpen(false);
        return;
      }
      setCancelOpen(false);
      router.refresh();
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
      setCancelOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.lifecyclePanel}
      aria-labelledby="transfer-actions-title"
    >
      <h2 id="transfer-actions-title">Управление переводом</h2>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.lifecycleButtons}>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          Изменить
        </Button>
        <Button variant="danger" onClick={() => setCancelOpen(true)}>
          Отменить перевод
        </Button>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Изменить перевод"
        description="Старая операция будет отменена, а исправленная сохранится целиком."
        dismissible={!pending}
      >
        <form action={edit} className={styles.editForm}>
          <FormField label="Сумма" required>
            <MoneyInput
              defaultValue={formatMoney(deserializeMoney(amountMinor), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              onValueChange={setAmount}
              allowNegative={false}
            />
          </FormField>
          <FormField label="Со счёта" required>
            <Select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="На счёт" required>
            <Select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              {accounts
                .filter((account) => account.id !== source)
                .map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Комментарий">
            <Input name="comment" defaultValue={note ?? ""} maxLength={500} />
          </FormField>
          <FormField label="Дата и время" required>
            <Input
              name="occurredAt"
              type="datetime-local"
              defaultValue={toDatetimeLocal(new Date(occurredAt))}
            />
          </FormField>
          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
          <div className={styles.lifecycleButtons}>
            <Button type="submit" pending={pending}>
              Сохранить
            </Button>
            <Button
              variant="secondary"
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
        title="Отменить перевод?"
        description="Обе проводки будут атомарно компенсированы. Общий капитал не изменится."
        confirmLabel="Отменить перевод"
        pending={pending}
        onConfirm={cancel}
      />
    </section>
  );
}

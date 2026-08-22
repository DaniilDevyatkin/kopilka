"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Button,
  Dialog,
  FormField,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui";
import { GOAL_CATEGORIES, GOAL_PRIORITIES } from "@/lib/goals/catalog";
import {
  deserializeMoney,
  formatMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import {
  archiveGoalAction,
  restoreGoalAction,
  updateGoalAction,
} from "@/server/actions/goals";
import styles from "./goals.module.css";

export function GoalActions({
  goalId,
  archived,
  goal,
}: {
  goalId: string;
  archived: boolean;
  goal: {
    name: string;
    category: (typeof GOAL_CATEGORIES)[number]["value"];
    priority: (typeof GOAL_PRIORITIES)[number];
    description: string | null;
    targetAmountMinor: SerializedMoney;
    targetDate: string | null;
    currency: SupportedCurrency;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [targetAmount, setTargetAmount] = useState<SerializedMoney | null>(
    goal.targetAmountMinor,
  );

  function mutate() {
    setMessage(null);
    startTransition(async () => {
      const result = archived
        ? await restoreGoalAction(goalId)
        : await archiveGoalAction(goalId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  function edit(formData: FormData) {
    setMessage(null);
    if (!targetAmount) {
      setMessage("Введите сумму цели.");
      return;
    }
    startTransition(async () => {
      const result = await updateGoalAction({
        goalId,
        name: String(formData.get("name") ?? ""),
        category: String(
          formData.get("category") ?? "OTHER",
        ) as typeof goal.category,
        priority: String(
          formData.get("priority") ?? "MEDIUM",
        ) as typeof goal.priority,
        description: String(formData.get("description") ?? ""),
        targetAmountMinor: deserializeMoney(targetAmount),
        targetDate: String(formData.get("targetDate") ?? "") || null,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setEditOpen(false);
      router.refresh();
    });
  }

  return (
    <div className={styles.goalActions}>
      {!archived ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setEditOpen(true)}
        >
          Изменить
        </Button>
      ) : null}
      <Button
        type="button"
        variant={archived ? "secondary" : "ghost"}
        pending={pending}
        onClick={mutate}
      >
        {archived ? "Вернуть в активные" : "Архивировать"}
      </Button>
      <p role={message ? "alert" : undefined}>{message}</p>
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Изменить хотелку"
        description="Резерв и история операций останутся без изменений."
        dismissible={!pending}
      >
        <form action={edit} className={styles.editGoalForm}>
          <FormField label="Название" required>
            <Input
              name="name"
              defaultValue={goal.name}
              maxLength={160}
              required
            />
          </FormField>
          <div className={styles.formGrid}>
            <FormField label="Категория" required>
              <Select name="category" defaultValue={goal.category}>
                {GOAL_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.labelRu}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Приоритет" required>
              <Select name="priority" defaultValue={goal.priority}>
                {GOAL_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority === "HIGH"
                      ? "Высокий"
                      : priority === "MEDIUM"
                        ? "Средний"
                        : "Низкий"}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label={`Сумма цели, ${goal.currency}`} required>
            <MoneyInput
              name="targetAmount"
              currency={goal.currency}
              defaultValue={formatMoney(
                deserializeMoney(goal.targetAmountMinor),
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )}
              onValueChange={setTargetAmount}
            />
          </FormField>
          <FormField label="Срок">
            <Input
              type="date"
              name="targetDate"
              defaultValue={goal.targetDate ?? ""}
            />
          </FormField>
          <FormField label="Описание">
            <Textarea
              name="description"
              defaultValue={goal.description ?? ""}
              maxLength={1000}
              rows={4}
            />
          </FormField>
          {message ? <p role="alert">{message}</p> : null}
          <div className={styles.goalActions}>
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
    </div>
  );
}

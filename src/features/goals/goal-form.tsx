"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  Button,
  FormField,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/ui";
import { GOAL_CATEGORIES, GOAL_PRIORITIES } from "@/lib/goals/catalog";
import {
  GOAL_PERIOD_OPTIONS,
  goalTargetDate,
  type GoalPeriod,
} from "@/lib/goals/period";
import {
  formatMoney,
  type SerializedMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { createGoalAction } from "@/server/actions/goals";
import styles from "./goals.module.css";

interface GoalAccountOption {
  id: string;
  name: string;
}

const PRIORITY_LABELS = {
  HIGH: "Высокий",
  MEDIUM: "Средний",
  LOW: "Низкий",
} as const;

export function GoalForm({
  currency,
  accounts,
  timeZone,
  emergencyTargets,
}: {
  currency: SupportedCurrency;
  accounts: GoalAccountOption[];
  timeZone: string;
  emergencyTargets?: {
    threeMonths: SerializedMoney;
    sixMonths: SerializedMoney;
  };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [targetAmountMinor, setTargetAmountMinor] =
    useState<SerializedMoney | null>(null);
  const [targetPreset, setTargetPreset] = useState<{
    value: string;
    key: number;
  }>({ value: "", key: 0 });
  const [category, setCategory] = useState("OTHER");
  const [initialAmountMinor, setInitialAmountMinor] =
    useState<SerializedMoney | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePending, setImagePending] = useState(false);

  function submit(formData: FormData) {
    if (!targetAmountMinor || BigInt(targetAmountMinor) <= 0n) {
      setAmountError("Укажите положительную сумму цели.");
      formRef.current
        ?.querySelector<HTMLElement>("[name='targetAmount']")
        ?.focus();
      return;
    }
    setAmountError(null);
    setMessage(null);
    const sourceAccountId = String(formData.get("sourceAccountId") ?? "");

    startTransition(async () => {
      try {
        const result = await createGoalAction({
          name: String(formData.get("name") ?? ""),
          category: String(
            formData.get("category") ?? "OTHER",
          ) as (typeof GOAL_CATEGORIES)[number]["value"],
          description: String(formData.get("description") ?? ""),
          targetAmountMinor: BigInt(targetAmountMinor),
          targetDate: goalTargetDate(
            String(formData.get("period") ?? "MONTH") as GoalPeriod,
            timeZone,
          ),
          priority: String(
            formData.get("priority") ?? "MEDIUM",
          ) as (typeof GOAL_PRIORITIES)[number],
          ...(imageAssetId ? { imageAssetId } : {}),
          ...(initialAmountMinor &&
          BigInt(initialAmountMinor) > 0n &&
          sourceAccountId
            ? {
                initialReservation: {
                  sourceAccountId,
                  amountMinor: BigInt(initialAmountMinor),
                  occurredAt: new Date().toISOString(),
                },
              }
            : {}),
          idempotencyKey: `goal-ui:${crypto.randomUUID()}`,
        });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.push(`/app/goals/${result.data.goal.id}`);
        router.refresh();
      } catch {
        setMessage("Не удалось связаться с сервером. Проверьте подключение.");
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className={styles.form} noValidate>
      <FormField label="Название" required>
        <Input name="name" maxLength={160} autoComplete="off" required />
      </FormField>
      <div className={styles.formGrid}>
        <FormField label="Категория" required>
          <Select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          >
            {GOAL_CATEGORIES.map((category) => (
              <option value={category.value} key={category.value}>
                {category.labelRu}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Приоритет" required>
          <Select name="priority" defaultValue="MEDIUM" required>
            {GOAL_PRIORITIES.map((priority) => (
              <option value={priority} key={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {category === "EMERGENCY_FUND" && emergencyTargets ? (
        <section
          className={styles.emergencyGuide}
          aria-label="Ориентир подушки"
        >
          <div>
            <strong>Ориентир финансовой подушки</strong>
            <p>
              Это не финансовый совет — только расчёт от ваших обязательных
              расходов.
            </p>
          </div>
          <div className={styles.emergencyOptions}>
            {[
              { label: "3 месяца", value: emergencyTargets.threeMonths },
              { label: "6 месяцев", value: emergencyTargets.sixMonths },
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                size="small"
                variant="secondary"
                onClick={() => {
                  setTargetAmountMinor(option.value);
                  setTargetPreset({
                    value: formatMoney(BigInt(option.value)),
                    key: targetPreset.key + 1,
                  });
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
      <div className={styles.formGrid}>
        <FormField
          label={`Сумма цели, ${currency}`}
          error={amountError}
          required
        >
          <MoneyInput
            key={targetPreset.key}
            name="targetAmount"
            currency={currency}
            defaultValue={targetPreset.value}
            required
            onValueChange={setTargetAmountMinor}
          />
        </FormField>
        <FormField label="Период накопления" required>
          <Select name="period" defaultValue="MONTH" required>
            {GOAL_PERIOD_OPTIONS.map((period) => (
              <option value={period.value} key={period.value}>
                {period.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField label="Описание" hint="До 1000 символов.">
        <Textarea name="description" maxLength={1000} rows={4} />
      </FormField>
      <fieldset className={styles.imageFieldset} disabled={imagePending}>
        <legend>Изображение хотелки</legend>
        <label className={styles.imageUpload}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setImagePending(true);
              setImageError(null);
              const preview = URL.createObjectURL(file);
              try {
                const body = new FormData();
                body.set("file", file);
                const response = await fetch("/api/goals/images", {
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
                if (imageAssetId) {
                  await fetch(`/api/goals/images/${imageAssetId}`, {
                    method: "DELETE",
                  }).catch(() => {});
                }
                setImageAssetId(result.id);
                setImagePreview(preview);
              } catch (error) {
                URL.revokeObjectURL(preview);
                setImageError(
                  error instanceof Error
                    ? error.message
                    : "Не удалось загрузить изображение.",
                );
              } finally {
                setImagePending(false);
              }
            }}
          />
          <span className={styles.imagePreview}>
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt="Предпросмотр хотелки"
                fill
                unoptimized
                sizes="160px"
              />
            ) : (
              <span>Добавить свою картинку</span>
            )}
          </span>
        </label>
        {imageError ? <p role="alert">{imageError}</p> : null}
      </fieldset>
      <fieldset
        className={styles.reserveFieldset}
        disabled={accounts.length === 0}
      >
        <legend>Уже отложено</legend>
        <p>
          Не создаёт новые деньги: сумма станет виртуальным резервом выбранного
          счёта.
        </p>
        <div className={styles.formGrid}>
          <FormField label={`Сумма резерва, ${currency}`}>
            <MoneyInput
              name="initialAmount"
              currency={currency}
              onValueChange={setInitialAmountMinor}
            />
          </FormField>
          <FormField label="Счёт-источник">
            <Select name="sourceAccountId" defaultValue="">
              <option value="">Не резервировать сейчас</option>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </fieldset>
      <div className={styles.formFooter}>
        <p role={message ? "alert" : undefined}>{message}</p>
        <SubmitButton pending={pending} pendingLabel="Создаём хотелку">
          Создать хотелку
        </SubmitButton>
      </div>
    </form>
  );
}

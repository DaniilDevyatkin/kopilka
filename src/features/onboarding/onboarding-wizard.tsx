"use client";

import { useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { OnboardingArtwork } from "@/components/graphics";
import { Button, FormField, Input, MoneyInput, Select } from "@/components/ui";
import { CARD_THEMES } from "@/lib/accounts/catalog";
import {
  deserializeMoney,
  formatCurrency,
  type SerializedMoney,
} from "@/lib/money";
import { resolveIanaTimeZone } from "@/lib/dates";
import { GOAL_CATEGORIES } from "@/lib/goals/catalog";
import {
  GOAL_PERIOD_OPTIONS,
  goalTargetDate,
  type GoalPeriod,
} from "@/lib/goals/period";
import {
  getOnboardingStateAction,
  submitAccountStepAction,
  submitBudgetStepAction,
  submitGoalStepAction,
} from "@/server/actions/onboarding";
import type { OnboardingStateReadModel } from "@/server/onboarding/service";
import type {
  SubmitAccountStepInput,
  SubmitBudgetStepInput,
  SubmitGoalStepInput,
} from "@/server/onboarding/validation";
import styles from "./onboarding.module.css";

const STEP_ORDER = ["ACCOUNT", "BUDGET", "GOAL"] as const;
const STEP_INDEX: Record<(typeof STEP_ORDER)[number], number> = {
  ACCOUNT: 0,
  BUDGET: 1,
  GOAL: 2,
};

function stepIndexOf(currentStep: OnboardingStateReadModel["currentStep"]) {
  return currentStep === "COMPLETED"
    ? STEP_ORDER.length
    : STEP_INDEX[currentStep];
}

function parseMoneyOrNull(value: SerializedMoney | null): bigint | null {
  if (value === null) return null;
  try {
    return deserializeMoney(value);
  } catch {
    return null;
  }
}

function browserTimeZone(fallback: string): string {
  try {
    return resolveIanaTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      fallback,
    );
  } catch {
    return resolveIanaTimeZone(fallback);
  }
}

interface StepPanelProps {
  eyebrow?: string;
  title: string;
  description?: string;
  variant: "accounts" | "income" | "goals";
  children: React.ReactNode;
  actions: React.ReactNode;
}

function StepPanel({
  eyebrow,
  title,
  description,
  variant,
  children,
  actions,
}: StepPanelProps) {
  const generatedArtwork =
    variant === "accounts"
      ? {
          src: "/onboarding/first-account.png",
          className: styles.accountArtwork,
        }
      : variant === "income"
        ? {
            src: "/onboarding/first-budget.png",
            className: styles.budgetArtwork,
          }
        : variant === "goals"
          ? { src: "/onboarding/first-goal.png", className: styles.goalArtwork }
          : null;

  return (
    <section className={styles.panel}>
      {generatedArtwork ? (
        <Image
          src={generatedArtwork.src}
          alt=""
          width={512}
          height={512}
          priority
          className={generatedArtwork.className}
        />
      ) : (
        <OnboardingArtwork variant={variant} className={styles.artwork} />
      )}
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      {children}
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}

function ProgressHeader({ current }: { current: number }) {
  const labels = ["Счёт", "Бюджет", "Хотелка"];
  return (
    <ol className={styles.progress} aria-label="Шаги настройки">
      {labels.map((label, index) => (
        <li
          key={label}
          className={[
            styles.progressItem,
            index === current ? styles.progressCurrent : "",
            index < current ? styles.progressDone : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={styles.progressDot} aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

interface StepSharedProps {
  state: OnboardingStateReadModel;
  error: string | null;
  onError: (message: string | null) => void;
}

interface AccountStepProps extends StepSharedProps {
  run: (input: SubmitAccountStepInput) => Promise<void>;
}

interface BudgetStepProps extends StepSharedProps {
  run: (input: SubmitBudgetStepInput) => Promise<void>;
  goBack: () => void;
}

interface GoalStepProps extends StepSharedProps {
  run: (input: SubmitGoalStepInput) => Promise<void>;
  goBack: () => void;
}

export function OnboardingWizard({
  initial,
}: {
  initial: OnboardingStateReadModel;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [view, setView] = useState(() => stepIndexOf(initial.currentStep));
  const [error, setError] = useState<string | null>(null);

  async function runStep<T>(
    action: () => Promise<
      { ok: true; data: T } | { ok: false; code: string; message: string }
    >,
    adopt: (data: T) => void,
  ): Promise<void> {
    setError(null);
    const result = await action();
    if (result.ok) {
      adopt(result.data);
      return;
    }
    const refreshed = await getOnboardingStateAction();
    if (refreshed.ok && refreshed.data.currentStep !== state.currentStep) {
      setState(refreshed.data);
      setView(stepIndexOf(refreshed.data.currentStep));
    } else {
      setError(result.message);
    }
  }

  const runAccount = (input: SubmitAccountStepInput) =>
    runStep(
      () => submitAccountStepAction(input),
      (data) => {
        setState(data);
        setView(1);
      },
    );

  const runBudget = (input: SubmitBudgetStepInput) =>
    runStep(
      () => submitBudgetStepAction(input),
      (data) => {
        setState(data);
        setView(2);
      },
    );

  const runGoal = (input: SubmitGoalStepInput) =>
    runStep(
      () => submitGoalStepAction(input),
      (data) => {
        setState(data);
        router.push("/app/home");
      },
    );

  if (state.currentStep === "COMPLETED") {
    return (
      <div className={styles.panel}>
        <OnboardingArtwork variant="goals" className={styles.artwork} />
        <h1 className={styles.title}>Копилка готова</h1>
        <p className={styles.description}>
          Настройка завершена. Открываем приложение.
        </p>
        <div className={styles.actions}>
          <Button
            className={styles.actionButton}
            size="large"
            onClick={() => router.push("/app/home")}
          >
            Перейти к Копилке
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <ProgressHeader current={view} />
      {view === 0 ? (
        <AccountStep
          state={state}
          error={error}
          onError={setError}
          run={runAccount}
        />
      ) : null}
      {view === 1 ? (
        <BudgetStep
          state={state}
          error={error}
          onError={setError}
          run={runBudget}
          goBack={() => setView(0)}
        />
      ) : null}
      {view === 2 ? (
        <GoalStep
          state={state}
          error={error}
          onError={setError}
          run={runGoal}
          goBack={() => setView(1)}
        />
      ) : null}
    </div>
  );
}

function AccountSummary({ state }: { state: OnboardingStateReadModel }) {
  const account = state.account;
  if (!account) return null;
  return (
    <dl className={styles.summary}>
      <div>
        <dt>Первый счёт</dt>
        <dd>{account.name}</dd>
      </div>
      <div>
        <dt>Баланс</dt>
        <dd>
          {formatCurrency(
            deserializeMoney(account.balanceMinor),
            account.currency,
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            },
          )}
        </dd>
      </div>
    </dl>
  );
}

function AccountStep({ state, error, run }: AccountStepProps) {
  const [name, setName] = useState("");
  const [visualTheme, setVisualTheme] = useState<string>(CARD_THEMES[0].value);
  const [openingBalance, setOpeningBalance] = useState<SerializedMoney | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const existingAccount = state.account !== null;
  const shownError = error ?? formError;

  async function handleSubmit() {
    if (existingAccount) {
      setPending(true);
      await run({
        name: "Первый счёт",
        visualTheme,
        openingBalanceMinor: 0n,
      });
      setPending(false);
      return;
    }
    const openingBalanceMinor = parseMoneyOrNull(openingBalance);
    if (name.trim() === "" || openingBalanceMinor === null) {
      setFormError(
        name.trim() === ""
          ? "Укажите название счёта."
          : "Укажите стартовый баланс.",
      );
      return;
    }
    setPending(true);
    await run({
      name: name.trim(),
      visualTheme,
      openingBalanceMinor,
    });
    setPending(false);
  }

  return (
    <StepPanel
      title={existingAccount ? "Первый счёт создан" : "Создание первого счета"}
      variant="accounts"
      actions={
        <Button
          className={styles.actionButton}
          size="large"
          pending={pending}
          onClick={() => void handleSubmit()}
        >
          Продолжить
        </Button>
      }
    >
      {existingAccount ? (
        <>
          <AccountSummary state={state} />
          <p className={styles.hint}>
            Счёт сохранился сервером. Продолжите настройку — менять его здесь не
            нужно.
          </p>
        </>
      ) : (
        <div className={styles.form}>
          <FormField label="Название" required>
            <Input
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={120}
              autoComplete="off"
            />
          </FormField>
          <FormField label="Стартовый баланс" required>
            <MoneyInput currency="RUB" onValueChange={setOpeningBalance} />
          </FormField>
          <fieldset className={styles.themeGroup}>
            <legend>Визуальный стиль</legend>
            <div className={styles.themeOptions}>
              {CARD_THEMES.map((theme) => (
                <label key={theme.value} className={styles.themeOption}>
                  <input
                    type="radio"
                    name="visualTheme"
                    value={theme.value}
                    checked={visualTheme === theme.value}
                    onChange={() => setVisualTheme(theme.value)}
                  />
                  <span className={styles.themeSwatch} aria-hidden="true">
                    <Image
                      src={theme.src}
                      alt=""
                      fill
                      sizes="(max-width: 560px) 100vw, 260px"
                    />
                  </span>
                  <span className={styles.themeLabel}>{theme.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {shownError ? (
            <p className={styles.error} role="alert">
              {shownError}
            </p>
          ) : null}
        </div>
      )}
    </StepPanel>
  );
}

function BudgetStep({ state, error, run, goBack }: BudgetStepProps) {
  const [income, setIncome] = useState<SerializedMoney | null>(null);
  const [expenses, setExpenses] = useState<SerializedMoney | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const shownError = error ?? formError;

  async function handleSubmit() {
    const incomeMinor = parseMoneyOrNull(income);
    const expensesMinor = parseMoneyOrNull(expenses) ?? 0n;
    if (incomeMinor === null) {
      setFormError("Укажите ежемесячный доход.");
      return;
    }
    if (expensesMinor > incomeMinor) {
      setFormError("Обязательные расходы не могут превышать доход.");
      return;
    }
    setPending(true);
    await run({
      monthlyIncomeMinor: incomeMinor,
      mandatoryMonthlyExpensesMinor: expensesMinor,
      timeZone: browserTimeZone(state.settings.timeZone),
    });
    setPending(false);
  }

  return (
    <StepPanel
      title="Бюджет"
      description="Зная доход и обязательные расходы, Копилка считает свободные средства и предлагает реалистичный план накопления."
      variant="income"
      actions={
        <>
          <Button
            className={styles.actionButton}
            size="large"
            pending={pending}
            onClick={() => void handleSubmit()}
          >
            Продолжить
          </Button>
          <Button
            className={styles.actionButton}
            variant="ghost"
            size="medium"
            onClick={goBack}
          >
            Назад
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <FormField label="Доход в месяц" required>
          <MoneyInput
            currency={state.user.baseCurrency}
            onValueChange={setIncome}
          />
        </FormField>
        <FormField
          label="Обязательные расходы в месяц"
          hint="Аренда, связь, подписки. Необязательно — можно заполнить позже."
        >
          <MoneyInput
            currency={state.user.baseCurrency}
            onValueChange={setExpenses}
          />
        </FormField>
        {shownError ? (
          <p className={styles.error} role="alert">
            {shownError}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

function GoalStep({ state, error, run, goBack }: GoalStepProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [targetAmount, setTargetAmount] = useState<SerializedMoney | null>(
    null,
  );
  const [period, setPeriod] = useState<GoalPeriod>("MONTH");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const shownError = error ?? formError;

  async function handleSubmit() {
    const targetAmountMinor = parseMoneyOrNull(targetAmount);
    if (name.trim() === "" || targetAmountMinor === null) {
      setFormError(
        name.trim() === ""
          ? "Укажите название хотелки."
          : "Укажите сумму цели.",
      );
      return;
    }
    setPending(true);
    await run({
      skip: false,
      goal: {
        name: name.trim(),
        category: category as (typeof GOAL_CATEGORIES)[number]["value"],
        targetAmountMinor: targetAmountMinor,
        targetDate: goalTargetDate(
          period,
          browserTimeZone(state.settings.timeZone),
        ),
        alreadySavedMinor: 0n,
      },
    });
    setPending(false);
  }

  async function handleSkip() {
    setPending(true);
    await run({ skip: true });
    setPending(false);
  }

  return (
    <StepPanel
      title="Первая хотелка"
      description="Цель придаёт накоплению направление. Можно создать её сейчас или пропустить и вернуться позже."
      variant="goals"
      actions={
        <>
          <Button
            className={styles.actionButton}
            size="large"
            pending={pending}
            onClick={() => void handleSubmit()}
          >
            Готово
          </Button>
          <Button
            className={styles.actionButton}
            variant="secondary"
            size="medium"
            disabled={pending}
            onClick={() => void handleSkip()}
          >
            Пропустить
          </Button>
          <Button
            className={styles.actionButton}
            variant="ghost"
            size="medium"
            onClick={goBack}
          >
            Назад
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <FormField label="Название хотелки" required>
          <Input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={160}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Категория" required>
          <Select
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value)}
          >
            {GOAL_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.labelRu}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Сумма цели" required>
          <MoneyInput
            currency={state.user.baseCurrency}
            onValueChange={setTargetAmount}
          />
        </FormField>
        <FormField label="Срок накопления" required>
          <Select
            value={period}
            onChange={(event) =>
              setPeriod(event.currentTarget.value as GoalPeriod)
            }
          >
            {GOAL_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        {shownError ? (
          <p className={styles.error} role="alert">
            {shownError}
          </p>
        ) : null}
      </div>
    </StepPanel>
  );
}

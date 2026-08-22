import type { Metadata } from "next";
import Link from "next/link";

import { GoalProgress } from "@/components/charts";
import { AppIcon } from "@/components/icons";
import styles from "@/features/goals/goals.module.css";
import { parseTargetDate, todayInTimeZone } from "@/lib/dates";
import { calculateGoalPlan, sumGoalPlans } from "@/lib/goals/calculations";
import { GOAL_CATEGORIES } from "@/lib/goals/catalog";
import { formatCurrency, type SupportedCurrency } from "@/lib/money";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";
import { goalService } from "@/server/goals/index";

export const metadata: Metadata = { title: "Хотелки — Копилка" };

const PRIORITY_LABELS = {
  HIGH: "Высокий",
  MEDIUM: "Средний",
  LOW: "Низкий",
} as const;

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await guardPrivateRoute();
  const view = (await searchParams).view === "archive" ? "ARCHIVE" : "ACTIVE";
  const goals = await goalService.listGoals(user.id, view);
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      monthlyIncomeMinor: true,
      mandatoryMonthlyExpensesMinor: true,
      timeZone: true,
    },
  });
  const timeZone = settings?.timeZone ?? "Europe/Moscow";
  const today = todayInTimeZone(timeZone);
  const currency = user.baseCurrency as SupportedCurrency;
  const plans = goals.map((goal) =>
    calculateGoalPlan({
      targetMinor: goal.targetAmountMinor,
      savedMinor: goal.reservedAmountMinor,
      today,
      targetDate: goal.targetDate ? parseTargetDate(goal.targetDate) : null,
      monthlyIncomeMinor: settings?.monthlyIncomeMinor ?? 0n,
      mandatoryMonthlyExpensesMinor:
        settings?.mandatoryMonthlyExpensesMinor ?? 0n,
    }),
  );
  const totalPlan = sumGoalPlans(plans);
  const availableMonthly = (() => {
    const income = settings?.monthlyIncomeMinor ?? 0n;
    const expenses = settings?.mandatoryMonthlyExpensesMinor ?? 0n;
    return income > expenses ? income - expenses : 0n;
  })();
  const planExceedsBudget =
    totalPlan.approximateMonthlyContributionMinor > availableMonthly;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>{view === "ACTIVE" ? "Хотелки" : "Архив хотелок"}</h1>
        <Link className={styles.newLink} href="/app/goals/new">
          <AppIcon name="add" size={20} />
          Добавить
        </Link>
      </header>

      <nav className={styles.tabs} aria-label="Разделы хотелок">
        <Link
          className={styles.tab}
          data-active={view === "ACTIVE"}
          href="/app/goals"
        >
          Активные
        </Link>
        <Link
          className={styles.tab}
          data-active={view === "ARCHIVE"}
          href="/app/goals?view=archive"
        >
          Архив
        </Link>
      </nav>

      {view === "ACTIVE" && goals.length ? (
        <section className={styles.totalPlan} aria-label="Общий план хотелок">
          <div className={styles.totalPrimary}>
            <span>Осталось собрать</span>
            <strong data-amount>
              {formatCurrency(totalPlan.remainingMinor, currency)}
            </strong>
          </div>
          <div className={styles.totalBreakdown}>
            <div>
              <span>В неделю</span>
              <strong data-amount>
                {formatCurrency(totalPlan.weeklyContributionMinor, currency)}
              </strong>
            </div>
            <div>
              <span>В месяц</span>
              <strong data-amount>
                {formatCurrency(
                  totalPlan.approximateMonthlyContributionMinor,
                  currency,
                )}
              </strong>
            </div>
          </div>
          {planExceedsBudget ? (
            <p className={styles.planWarning}>
              Общий темп выше свободного бюджета. Измените срок или приоритет
              одной из хотелок — Копилка ничего не перераспределяет без вашего
              решения.
            </p>
          ) : null}
        </section>
      ) : null}

      {goals.length ? (
        <section className={styles.grid} aria-label="Список хотелок">
          {goals.map((goal, goalIndex) => {
            const category = GOAL_CATEGORIES.find(
              (entry) => entry.value === goal.category,
            )!;
            const remaining =
              goal.targetAmountMinor > goal.reservedAmountMinor
                ? goal.targetAmountMinor - goal.reservedAmountMinor
                : 0n;
            const plan = plans[goalIndex]!;
            const fallbackMonthly =
              plan.noDateScenarios?.find((scenario) => scenario.percent === 20)
                ?.monthlyContributionMinor ?? 0n;
            const displayMonthly =
              plan.approximateMonthlyContributionMinor ?? fallbackMonthly;
            const displayWeekly =
              plan.weeklyContributionMinor ??
              (fallbackMonthly === 0n
                ? 0n
                : (fallbackMonthly * 12n + 51n) / 52n);
            const displayDaily =
              plan.dailyContributionMinor ??
              (displayWeekly === 0n ? 0n : (displayWeekly + 6n) / 7n);
            return (
              <Link
                className={styles.card}
                href={`/app/goals/${goal.id}`}
                key={goal.id}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.categoryIcon} aria-hidden="true">
                    <AppIcon name={category.iconName} size={24} />
                  </span>
                  <div>
                    <h2>{goal.name}</h2>
                    <p>{category.labelRu}</p>
                  </div>
                  <span className={styles.priority}>
                    {PRIORITY_LABELS[goal.priority]}
                  </span>
                </div>
                <GoalProgress
                  label={`Накоплено на ${goal.name}`}
                  savedMinor={goal.reservedAmountMinor}
                  targetMinor={goal.targetAmountMinor}
                  currency={currency}
                />
                <div className={styles.meta}>
                  <span>
                    <small>Осталось</small>
                    <strong data-amount>
                      {formatCurrency(remaining, currency)}
                    </strong>
                  </span>
                  <span>
                    <small>Срок</small>
                    <strong>
                      {goal.targetDate
                        ? `До ${goal.targetDate}`
                        : "Без жёсткого срока"}
                    </strong>
                  </span>
                </div>
                <div className={styles.planBlock}>
                  <p className={styles.planLabel}>Ритм накопления</p>
                  <div
                    className={styles.savingPlan}
                    aria-label="План накопления"
                  >
                    <span>
                      <small>В день</small>
                      <strong data-amount>
                        {formatCurrency(displayDaily, currency)}
                      </strong>
                    </span>
                    <span>
                      <small>В неделю</small>
                      <strong data-amount>
                        {formatCurrency(displayWeekly, currency)}
                      </strong>
                    </span>
                    <span>
                      <small>В месяц</small>
                      <strong data-amount>
                        {formatCurrency(displayMonthly, currency)}
                      </strong>
                    </span>
                  </div>
                </div>
                {plan.feasibility ? (
                  <span
                    className={styles.feasibility}
                    data-level={plan.feasibility}
                  >
                    {plan.feasibility === "comfortable"
                      ? "Комфортный темп"
                      : plan.feasibility === "strained"
                        ? "Напряжённый темп"
                        : "Срок требует пересмотра"}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </section>
      ) : (
        <div className={styles.empty}>
          {view === "ACTIVE"
            ? "Активных хотелок пока нет. Добавьте первую цель — без давления и двойного учёта денег."
            : "Архив пока пуст."}
        </div>
      )}
    </div>
  );
}

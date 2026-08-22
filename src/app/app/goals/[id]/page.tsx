import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GoalProgress } from "@/components/charts";
import { AppIcon } from "@/components/icons";
import { GoalActions } from "@/features/goals/goal-actions";
import { GoalLifecycleActions } from "@/features/goals/goal-lifecycle-actions";
import { accountService } from "@/server/accounts";
import styles from "@/features/goals/goals.module.css";
import { parseTargetDate, todayInTimeZone } from "@/lib/dates";
import { calculateGoalPlan } from "@/lib/goals/calculations";
import { GOAL_CATEGORIES } from "@/lib/goals/catalog";
import {
  formatCurrency,
  serializeMoney,
  type SupportedCurrency,
} from "@/lib/money";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { GoalError } from "@/server/goals/errors";
import { goalService } from "@/server/goals/index";
import { prisma } from "@/server/db/prisma";

export const metadata: Metadata = { title: "Хотелка — Копилка" };

const STATUS_LABELS = {
  ACTIVE: "Активна",
  ARCHIVED: "В архиве",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
} as const;
const PRIORITY_LABELS = {
  HIGH: "Высокий",
  MEDIUM: "Средний",
  LOW: "Низкий",
} as const;

export default async function GoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await guardPrivateRoute();
  let goal;
  try {
    goal = await goalService.getGoal(user.id, (await params).id);
  } catch (error) {
    if (error instanceof GoalError && error.code === "GOAL_NOT_FOUND")
      notFound();
    throw error;
  }
  const currency = user.baseCurrency as SupportedCurrency;
  const accounts = (await accountService.listAccounts(user.id)).filter(
    (account) => account.archivedAt === null,
  );
  const category = GOAL_CATEGORIES.find(
    (entry) => entry.value === goal.category,
  )!;
  const remaining =
    goal.targetAmountMinor > goal.reservedAmountMinor
      ? goal.targetAmountMinor - goal.reservedAmountMinor
      : 0n;
  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
    select: {
      monthlyIncomeMinor: true,
      mandatoryMonthlyExpensesMinor: true,
      timeZone: true,
    },
  });
  const plan = calculateGoalPlan({
    targetMinor: goal.targetAmountMinor,
    savedMinor: goal.reservedAmountMinor,
    today: todayInTimeZone(settings?.timeZone ?? "Europe/Moscow"),
    targetDate: goal.targetDate ? parseTargetDate(goal.targetDate) : null,
    monthlyIncomeMinor: settings?.monthlyIncomeMinor ?? 0n,
    mandatoryMonthlyExpensesMinor:
      settings?.mandatoryMonthlyExpensesMinor ?? 0n,
  });
  const fallbackMonthly =
    plan.noDateScenarios?.find((scenario) => scenario.percent === 20)
      ?.monthlyContributionMinor ?? 0n;
  const displayMonthly =
    plan.approximateMonthlyContributionMinor ?? fallbackMonthly;
  const displayWeekly =
    plan.weeklyContributionMinor ??
    (fallbackMonthly === 0n ? 0n : (fallbackMonthly * 12n + 51n) / 52n);
  const displayDaily =
    plan.dailyContributionMinor ??
    (displayWeekly === 0n ? 0n : (displayWeekly + 6n) / 7n);

  return (
    <div className={styles.page}>
      <Link className={styles.tab} href="/app/goals">
        <AppIcon name="back" size={20} />
        Все хотелки
      </Link>
      <article className={styles.detail}>
        <div className={styles.detailHero}>
          <div>
            <p>
              {category.labelRu} · {STATUS_LABELS[goal.status]}
            </p>
            <h1>{goal.name}</h1>
            {goal.description ? <p>{goal.description}</p> : null}
          </div>
          <span className={styles.categoryIcon} aria-hidden="true">
            <AppIcon name={category.iconName} size={24} />
          </span>
        </div>

        {goal.image ? (
          <div className={styles.goalImage}>
            <Image
              src={`/api/goals/images/${goal.image.id}`}
              alt={`Изображение хотелки «${goal.name}»`}
              fill
              priority
              unoptimized
              sizes="(max-width: 480px) 100vw, 480px"
            />
          </div>
        ) : null}

        <GoalProgress
          label={`Прогресс «${goal.name}»`}
          savedMinor={goal.reservedAmountMinor}
          targetMinor={goal.targetAmountMinor}
          currency={currency}
        />

        <div className={styles.detailStats}>
          <div className={styles.stat}>
            <span>Цель</span>
            <strong data-amount>
              {formatCurrency(goal.targetAmountMinor, currency)}
            </strong>
          </div>
          <div className={styles.stat}>
            <span>В резерве</span>
            <strong data-amount>
              {formatCurrency(goal.reservedAmountMinor, currency)}
            </strong>
          </div>
          <div className={styles.stat}>
            <span>Осталось</span>
            <strong data-amount>{formatCurrency(remaining, currency)}</strong>
          </div>
        </div>

        <section
          className={styles.detailPlan}
          aria-labelledby="saving-plan-title"
        >
          <div>
            <p>План накопления</p>
            <h2 id="saving-plan-title">Сколько откладывать</h2>
          </div>
          <div className={styles.savingPlan}>
            <span>
              <small>Каждый день</small>
              <strong data-amount>
                {formatCurrency(displayDaily, currency)}
              </strong>
            </span>
            <span>
              <small>Каждую неделю</small>
              <strong data-amount>
                {formatCurrency(displayWeekly, currency)}
              </strong>
            </span>
            <span>
              <small>Каждый месяц</small>
              <strong data-amount>
                {formatCurrency(displayMonthly, currency)}
              </strong>
            </span>
          </div>
          {plan.feasibility ? (
            <p className={styles.feasibility} data-level={plan.feasibility}>
              {plan.feasibility === "comfortable"
                ? "Этот темп укладывается в свободный месячный бюджет."
                : plan.feasibility === "strained"
                  ? "Темп достижим, но займёт заметную часть свободного бюджета."
                  : "При текущем бюджете срок нереалистичен — увеличьте срок или уменьшите сумму."}
            </p>
          ) : null}
        </section>

        <div className={styles.meta}>
          <span>Приоритет: {PRIORITY_LABELS[goal.priority]}</span>
          <span>
            {goal.targetDate ? `Срок: ${goal.targetDate}` : "Срок не задан"}
          </span>
        </div>
        {goal.status !== "COMPLETED" ? (
          <>
            {goal.status === "ACTIVE" && accounts.length > 0 ? (
              <GoalLifecycleActions
                goalId={goal.id}
                targetAmountMinor={goal.targetAmountMinor}
                reservedAmountMinor={goal.reservedAmountMinor}
                currency={currency}
                accounts={accounts.map((account) => ({
                  id: account.id,
                  name: account.name,
                }))}
              />
            ) : null}
            <GoalActions
              goalId={goal.id}
              archived={goal.status === "ARCHIVED"}
              goal={{
                name: goal.name,
                category: goal.category,
                priority: goal.priority,
                description: goal.description,
                targetAmountMinor: serializeMoney(goal.targetAmountMinor),
                targetDate: goal.targetDate,
                currency,
              }}
            />
          </>
        ) : null}
      </article>
    </div>
  );
}

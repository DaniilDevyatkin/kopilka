"use server";

import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import { parseMoney } from "@/lib/money";
import { getServerEnvironment } from "@/lib/env/server";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { assertSameOrigin } from "@/server/auth/same-origin";
import { prisma } from "@/server/db/prisma";

export interface ProfileSettingsActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Введите имя.").max(100),
  monthlyIncome: z.string().trim().min(1, "Введите доход."),
  mandatoryExpenses: z.string().trim().min(1, "Введите расходы."),
  reminderDay: z.coerce.number().int().min(1).max(7),
});

function money(value: string): bigint | null {
  try {
    const parsed = parseMoney(value, { currency: "RUB", allowNegative: false });
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

export async function updateProfileSettingsAction(
  _previous: ProfileSettingsActionState,
  formData: FormData,
): Promise<ProfileSettingsActionState> {
  try {
    assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
    const parsed = profileSchema.safeParse({
      displayName: formData.get("displayName"),
      monthlyIncome: formData.get("monthlyIncome"),
      mandatoryExpenses: formData.get("mandatoryExpenses"),
      reminderDay: formData.get("reminderDay"),
    });
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      return {
        ok: false,
        message: "Проверьте выделенные поля.",
        fieldErrors: Object.fromEntries(
          Object.entries(flattened).map(([key, messages]) => [
            key,
            messages?.[0] ?? "Неверное значение.",
          ]),
        ),
      };
    }
    const income = money(parsed.data.monthlyIncome);
    const expenses = money(parsed.data.mandatoryExpenses);
    const fieldErrors: Record<string, string> = {};
    if (income === null)
      fieldErrors.monthlyIncome = "Введите корректную сумму.";
    if (expenses === null)
      fieldErrors.mandatoryExpenses = "Введите корректную сумму.";
    if (
      Object.keys(fieldErrors).length ||
      income === null ||
      expenses === null
    ) {
      return { ok: false, message: "Проверьте выделенные поля.", fieldErrors };
    }

    const user = await requireAuthenticatedUser();
    const weeklyReminderEnabled =
      formData.get("weeklyReminderEnabled") === "on";
    const nearGoalEnabled = formData.get("nearGoalEnabled") === "on";
    const goalCompletedEnabled = formData.get("goalCompletedEnabled") === "on";
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { displayName: parsed.data.displayName },
      }),
      prisma.userSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          monthlyIncomeMinor: income,
          mandatoryMonthlyExpensesMinor: expenses,
        },
        update: {
          monthlyIncomeMinor: income,
          mandatoryMonthlyExpensesMinor: expenses,
        },
      }),
      prisma.notificationPreference.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          weeklyReminderEnabled,
          reminderDay: weeklyReminderEnabled ? parsed.data.reminderDay : null,
          reminderMinute: weeklyReminderEnabled ? 18 * 60 : null,
          nearGoalEnabled,
          goalCompletedEnabled,
        },
        update: {
          weeklyReminderEnabled,
          reminderDay: weeklyReminderEnabled ? parsed.data.reminderDay : null,
          reminderMinute: weeklyReminderEnabled ? 18 * 60 : null,
          nearGoalEnabled,
          goalCompletedEnabled,
        },
      }),
    ]);
    return { ok: true, message: "Настройки сохранены." };
  } catch {
    return {
      ok: false,
      message: "Не удалось сохранить настройки. Попробуйте ещё раз.",
    };
  }
}

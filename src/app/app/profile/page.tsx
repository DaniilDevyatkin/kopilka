import type { Metadata } from "next";

import { ProfileSecurity } from "@/components/auth/profile-security";
import styles from "@/components/auth/auth.module.css";
import { changePasswordAction, logoutAction } from "@/server/actions/auth";
import { ProfileSettingsForm } from "@/features/profile/profile-settings-form";
import { formatMoney } from "@/lib/money";
import { updateProfileSettingsAction } from "@/server/actions/profile";
import { guardPrivateRoute } from "@/server/auth/route-guards";
import { prisma } from "@/server/db/prisma";

export const metadata: Metadata = { title: "Профиль — Копилка" };

export default async function ProfilePage() {
  const user = await guardPrivateRoute();
  const [settings, notifications] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <div className={styles.profilePage}>
      <ProfileSecurity
        changePasswordAction={changePasswordAction}
        logoutAction={logoutAction}
      />
      <ProfileSettingsForm
        action={updateProfileSettingsAction}
        displayName={user.displayName ?? ""}
        monthlyIncome={formatMoney(settings?.monthlyIncomeMinor ?? 0n, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        mandatoryExpenses={formatMoney(
          settings?.mandatoryMonthlyExpensesMinor ?? 0n,
          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
        )}
        notifications={{
          weeklyReminderEnabled: notifications?.weeklyReminderEnabled ?? false,
          reminderDay: notifications?.reminderDay ?? 1,
          nearGoalEnabled: notifications?.nearGoalEnabled ?? false,
          goalCompletedEnabled: notifications?.goalCompletedEnabled ?? false,
        }}
      />
    </div>
  );
}

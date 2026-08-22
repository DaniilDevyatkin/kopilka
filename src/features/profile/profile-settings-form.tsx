"use client";

import { useActionState } from "react";

import { AppIcon } from "@/components/icons";
import {
  FormField,
  Input,
  MoneyInput,
  Select,
  SubmitButton,
  Switch,
} from "@/components/ui";
import type { ProfileSettingsActionState } from "@/server/actions/profile";
import styles from "@/components/auth/auth.module.css";

const INITIAL_STATE: ProfileSettingsActionState = {};

export function ProfileSettingsForm({
  action,
  displayName,
  monthlyIncome,
  mandatoryExpenses,
  notifications,
}: {
  action: (
    previous: ProfileSettingsActionState,
    formData: FormData,
  ) => Promise<ProfileSettingsActionState>;
  displayName: string;
  monthlyIncome: string;
  mandatoryExpenses: string;
  notifications: {
    weeklyReminderEnabled: boolean;
    reminderDay: number;
    nearGoalEnabled: boolean;
    goalCompletedEnabled: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <section
      className={styles.securitySection}
      aria-labelledby="profile-settings-title"
    >
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <AppIcon name="profile" size={24} />
        </span>
        <div className={styles.sectionIntro}>
          <h2 id="profile-settings-title">Личные настройки</h2>
          <p>Имя и месячный бюджет используются в подсказках по хотелкам.</p>
        </div>
      </div>
      <form action={formAction} className={styles.form}>
        <FormField label="Имя" error={state.fieldErrors?.displayName} required>
          <Input
            name="displayName"
            defaultValue={displayName}
            maxLength={100}
            autoComplete="name"
            required
          />
        </FormField>
        <FormField
          label="Доход в месяц"
          error={state.fieldErrors?.monthlyIncome}
          required
        >
          <MoneyInput
            name="monthlyIncome"
            currency="RUB"
            defaultValue={monthlyIncome}
            required
          />
        </FormField>
        <FormField
          label="Обязательные расходы в месяц"
          error={state.fieldErrors?.mandatoryExpenses}
          required
        >
          <MoneyInput
            name="mandatoryExpenses"
            currency="RUB"
            defaultValue={mandatoryExpenses}
            required
          />
        </FormField>
        <div className={styles.notificationGroup}>
          <h3>Напоминания</h3>
          <Switch
            name="weeklyReminderEnabled"
            defaultChecked={notifications.weeklyReminderEnabled}
            label="Еженедельный обзор"
            description="Напоминать проверить прогресс по бюджету."
          />
          <FormField label="День обзора">
            <Select
              name="reminderDay"
              defaultValue={String(notifications.reminderDay)}
            >
              <option value="1">Понедельник</option>
              <option value="2">Вторник</option>
              <option value="3">Среда</option>
              <option value="4">Четверг</option>
              <option value="5">Пятница</option>
              <option value="6">Суббота</option>
              <option value="7">Воскресенье</option>
            </Select>
          </FormField>
          <Switch
            name="nearGoalEnabled"
            defaultChecked={notifications.nearGoalEnabled}
            label="Хотелка почти собрана"
          />
          <Switch
            name="goalCompletedEnabled"
            defaultChecked={notifications.goalCompletedEnabled}
            label="Хотелка собрана"
          />
        </div>
        {state.message ? (
          <p
            className={state.ok ? styles.successMessage : styles.errorMessage}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
        <SubmitButton
          className={styles.profileAction}
          pending={pending}
          pendingLabel="Сохраняем"
        >
          Сохранить настройки
        </SubmitButton>
      </form>
    </section>
  );
}

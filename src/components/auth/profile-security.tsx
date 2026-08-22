"use client";

import { useEffect } from "react";

import { AppIcon } from "@/components/icons";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { FormField, PasswordInput, SubmitButton } from "@/components/ui";
import type { AuthAction, LogoutAction } from "@/features/auth/auth-form-types";
import { validatePasswordChangeForm } from "@/features/auth/auth-form-validation";
import { useAuthForm, useLogout } from "@/features/auth/use-auth-form";
import { ThemeSwitcher } from "@/features/theme/theme-switcher";
import { PrivacySwitcher } from "@/features/privacy/privacy-switcher";
import styles from "./auth.module.css";

export function ProfileSecurity({
  changePasswordAction,
  logoutAction,
}: {
  changePasswordAction: AuthAction;
  logoutAction: LogoutAction;
}) {
  const {
    formRef: passwordFormRef,
    formAction: passwordFormAction,
    pending: passwordPending,
    result: passwordResult,
  } = useAuthForm({
    action: changePasswordAction,
    validate: validatePasswordChangeForm,
    navigateOnSuccess: false,
  });
  const logout = useLogout(logoutAction);
  const passwordErrors =
    passwordResult && !passwordResult.ok
      ? {
          ...passwordResult.fieldErrors,
          ...(passwordResult.code === "CURRENT_PASSWORD_INVALID"
            ? { currentPassword: passwordResult.message }
            : {}),
        }
      : undefined;

  useEffect(() => {
    if (passwordResult?.ok) passwordFormRef.current?.reset();
  }, [passwordFormRef, passwordResult]);

  return (
    <div className={styles.securityStack}>
      <header className={styles.profileHeading}>
        <h1>Профиль</h1>
      </header>

      <section
        className={styles.securitySection}
        aria-labelledby="appearance-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <AppIcon name="eye" size={24} />
          </span>
          <div className={styles.sectionIntro}>
            <h2 id="appearance-title">Оформление</h2>
            <p>Настройте характер интерфейса под себя.</p>
          </div>
        </div>
        <div className={styles.themeControl}>
          <ThemeSwitcher />
        </div>
      </section>

      <section
        className={styles.securitySection}
        aria-labelledby="privacy-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <AppIcon name="eye-off" size={24} />
          </span>
          <div className={styles.sectionIntro}>
            <h2 id="privacy-title">Приватность сумм</h2>
            <p>Скройте цифры от постороннего взгляда одним переключателем.</p>
          </div>
        </div>
        <div className={styles.privacyControl}>
          <PrivacySwitcher />
        </div>
      </section>

      <section
        className={styles.securitySection}
        aria-labelledby="password-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <AppIcon name="settings" size={24} />
          </span>
          <div className={styles.sectionIntro}>
            <h2 id="password-title">Сменить пароль</h2>
            <p>После смены пароля другие устройства выйдут из аккаунта.</p>
          </div>
        </div>
        <form
          ref={passwordFormRef}
          action={passwordFormAction}
          className={styles.form}
          noValidate
        >
          <FormField
            label="Текущий пароль"
            error={passwordErrors?.currentPassword}
            required
          >
            <PasswordInput
              name="currentPassword"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </FormField>
          <FormField
            label="Новый пароль"
            hint="Не менее 12 символов и не такой, как текущий."
            error={passwordErrors?.newPassword}
            required
          >
            <PasswordInput
              name="newPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </FormField>
          <FormField
            label="Повторите новый пароль"
            error={passwordErrors?.repeatPassword}
            required
          >
            <PasswordInput
              name="repeatPassword"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </FormField>
          <AuthFormMessage
            result={passwordResult}
            successMessage="Пароль изменён. Остальные сессии завершены."
          />
          <SubmitButton
            className={styles.profileAction}
            pending={passwordPending}
            pendingLabel="Обновляем пароль"
          >
            Изменить пароль
          </SubmitButton>
        </form>
      </section>

      <section
        className={styles.securitySection}
        aria-labelledby="session-title"
      >
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <AppIcon name="logout" size={24} />
          </span>
          <div className={styles.sectionIntro}>
            <h2 id="session-title">Текущая сессия</h2>
            <p>Безопасно завершите работу на этом устройстве.</p>
          </div>
        </div>
        <form action={logout.formAction} className={styles.logoutForm}>
          <AuthFormMessage result={logout.result} />
          <SubmitButton
            variant="secondary"
            pending={logout.pending}
            pendingLabel="Завершаем сессию"
          >
            Выйти из аккаунта
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}

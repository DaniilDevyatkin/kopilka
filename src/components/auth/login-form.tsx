"use client";

import Link from "next/link";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { AuthHeading } from "@/components/auth/auth-heading";
import { FormField, Input, PasswordInput, SubmitButton } from "@/components/ui";
import type { AuthAction } from "@/features/auth/auth-form-types";
import { validateLoginForm } from "@/features/auth/auth-form-validation";
import { useAuthForm } from "@/features/auth/use-auth-form";
import styles from "./auth.module.css";

export function LoginForm({ action }: { action: AuthAction }) {
  const { formRef, formAction, pending, result } = useAuthForm({
    action,
    validate: validateLoginForm,
  });
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <section className={styles.authPanel} aria-labelledby="login-title">
      <AuthHeading
        eyebrow="Безопасный вход"
        title="Продолжите с того места, где остановились"
        description="Ваши счета и цели доступны только после проверки серверной сессии."
        icon="profile"
        titleId="login-title"
      />
      <form
        ref={formRef}
        action={formAction}
        className={styles.form}
        noValidate
      >
        <FormField label="Логин" error={errors?.login} required>
          <Input
            name="login"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={3}
            maxLength={64}
            required
          />
        </FormField>
        <FormField label="Пароль" error={errors?.password} required>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </FormField>
        <AuthFormMessage result={result} />
        <SubmitButton
          className={styles.submit}
          size="large"
          pending={pending}
          pendingLabel="Проверяем данные"
        >
          Войти
        </SubmitButton>
      </form>
      <p className={styles.switchFlow}>
        Впервые в Копилке? <Link href="/register">Создать аккаунт</Link>
      </p>
    </section>
  );
}

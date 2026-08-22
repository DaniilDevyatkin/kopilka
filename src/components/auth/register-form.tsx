"use client";

import Link from "next/link";

import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { FormField, Input, PasswordInput, SubmitButton } from "@/components/ui";
import type { AuthAction } from "@/features/auth/auth-form-types";
import { validateRegistrationForm } from "@/features/auth/auth-form-validation";
import { useAuthForm } from "@/features/auth/use-auth-form";
import styles from "./auth.module.css";

export function RegisterForm({ action }: { action: AuthAction }) {
  const { formRef, formAction, pending, result } = useAuthForm({
    action,
    validate: validateRegistrationForm,
  });
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  return (
    <section className={styles.authPanel} aria-label="Регистрация">
      <form
        ref={formRef}
        action={formAction}
        className={styles.form}
        noValidate
      >
        <FormField
          label="Логин"
          hint="От 3 до 64 символов: буквы, цифры, точка, дефис или подчёркивание."
          error={errors?.login}
          required
        >
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
        <FormField label="Имя" error={errors?.displayName} required>
          <Input
            name="displayName"
            autoComplete="name"
            maxLength={120}
            required
          />
        </FormField>
        <FormField
          label="Пароль"
          hint="Используйте не менее 12 символов. Можно вставить пароль из менеджера."
          error={errors?.password}
          required
        >
          <PasswordInput
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </FormField>
        <FormField
          label="Повторите пароль"
          error={errors?.repeatPassword}
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
        <AuthFormMessage result={result} />
        <SubmitButton
          className={styles.submit}
          size="large"
          pending={pending}
          pendingLabel="Создаём защищённую сессию"
        >
          Создать аккаунт
        </SubmitButton>
      </form>
      <p className={styles.switchFlow}>
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </section>
  );
}

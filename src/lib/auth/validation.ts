import { z } from "zod";

import type {
  AuthFieldErrors,
  AuthFieldName,
} from "@/features/auth/auth-form-types";

const loginSchema = z
  .string()
  .trim()
  .min(3, { error: "Введите логин: от 3 до 64 символов." })
  .max(64, { error: "Введите логин: от 3 до 64 символов." })
  .regex(/^[\p{L}\p{N}._-]+$/u, {
    error: "Используйте буквы, цифры, точку, дефис или подчёркивание.",
  });
const passwordSchema = z
  .string()
  .min(12, { error: "Используйте не менее 12 символов." })
  .max(128, { error: "Используйте не более 128 символов." });
const submittedPasswordSchema = z
  .string()
  .min(1, { error: "Введите пароль." })
  .max(128, { error: "Используйте не более 128 символов." });
const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Введите имя." })
  .max(120, { error: "Введите имя длиной до 120 символов." });

export const registrationInputSchema = z
  .object({
    login: loginSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    repeatPassword: passwordSchema,
  })
  .refine((value) => value.password === value.repeatPassword, {
    message: "Пароли не совпадают.",
    path: ["repeatPassword"],
  });

export const loginInputSchema = z.object({
  login: loginSchema,
  password: submittedPasswordSchema,
});

export const changePasswordInputSchema = z
  .object({
    currentPassword: submittedPasswordSchema,
    newPassword: passwordSchema,
    repeatPassword: passwordSchema,
  })
  .refine((value) => value.newPassword === value.repeatPassword, {
    message: "Пароли не совпадают.",
    path: ["repeatPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Новый пароль должен отличаться от текущего.",
    path: ["newPassword"],
  });

export type RegistrationInput = z.infer<typeof registrationInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

const AUTH_FIELD_NAMES = new Set<AuthFieldName>([
  "login",
  "displayName",
  "password",
  "repeatPassword",
  "currentPassword",
  "newPassword",
]);

export function authFieldErrors(error: z.ZodError): AuthFieldErrors {
  const fieldErrors: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      typeof field === "string" &&
      AUTH_FIELD_NAMES.has(field as AuthFieldName) &&
      !fieldErrors[field as AuthFieldName]
    ) {
      fieldErrors[field as AuthFieldName] = issue.message;
    }
  }
  return fieldErrors;
}

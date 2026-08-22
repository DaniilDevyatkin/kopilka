import "server-only";

import type { AuthErrorCode } from "@/features/auth/auth-form-types";

export type { AuthErrorCode } from "@/features/auth/auth-form-types";

const PUBLIC_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_INPUT: "Проверьте введённые данные.",
  INVALID_CREDENTIALS: "Неверный логин или пароль.",
  REGISTRATION_FAILED: "Не удалось создать аккаунт с указанными данными.",
  UNAUTHENTICATED: "Сессия недействительна. Войдите снова.",
  CURRENT_PASSWORD_INVALID: "Текущий пароль указан неверно.",
  RATE_LIMITED: "Слишком много попыток. Попробуйте позже.",
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.name = "AuthError";
    this.code = code;
  }
}

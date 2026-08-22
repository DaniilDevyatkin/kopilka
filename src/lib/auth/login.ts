const LOGIN_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const MIN_LOGIN_LENGTH = 3;
const MAX_LOGIN_LENGTH = 64;

export class LoginValidationError extends Error {
  override readonly name = "LoginValidationError";
}

export function normalizeLogin(input: string): string {
  const normalized = input.normalize("NFKC").trim().toLowerCase();

  if (
    normalized.length < MIN_LOGIN_LENGTH ||
    normalized.length > MAX_LOGIN_LENGTH ||
    !LOGIN_PATTERN.test(normalized)
  ) {
    throw new LoginValidationError("Login has an invalid format.");
  }

  return normalized;
}

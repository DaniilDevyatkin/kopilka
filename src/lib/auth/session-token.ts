export const SESSION_COOKIE_NAME = "kopilka_session";

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function isSessionToken(value: string): boolean {
  return SESSION_TOKEN_PATTERN.test(value);
}

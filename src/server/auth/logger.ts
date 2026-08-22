import "server-only";

export type AuthSecurityEvent =
  | "registration_failed"
  | "login_failed"
  | "password_change_failed"
  | "rate_limited"
  | "unexpected_auth_error";

export interface AuthLogger {
  warn(event: AuthSecurityEvent, metadata?: { requestId?: string }): void;
}

export const authLogger: AuthLogger = {
  warn(event, metadata = {}) {
    console.warn(
      JSON.stringify({
        scope: "auth",
        event,
        ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
      }),
    );
  },
};

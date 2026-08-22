export type AuthErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "REGISTRATION_FAILED"
  | "UNAUTHENTICATED"
  | "CURRENT_PASSWORD_INVALID"
  | "RATE_LIMITED";

export type AuthFieldName =
  | "login"
  | "displayName"
  | "password"
  | "repeatPassword"
  | "currentPassword"
  | "newPassword";

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type AuthActionResult =
  | {
      ok: true;
      nextPath: "/onboarding" | "/app/home" | "/app/profile" | "/login";
    }
  | {
      ok: false;
      code: AuthErrorCode;
      message: string;
      fieldErrors?: AuthFieldErrors;
    };

export type AuthAction = (formData: FormData) => Promise<AuthActionResult>;
export type LogoutAction = () => Promise<AuthActionResult>;

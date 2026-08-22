import "server-only";

export type OnboardingErrorCode = "INVALID_INPUT" | "STATE_CONFLICT";

export class OnboardingError extends Error {
  override readonly name = "OnboardingError";
  readonly code: OnboardingErrorCode;

  constructor(code: OnboardingErrorCode) {
    super(code);
    this.code = code;
  }
}

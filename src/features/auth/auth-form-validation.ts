import {
  authFieldErrors,
  changePasswordInputSchema,
  loginInputSchema,
  registrationInputSchema,
} from "@/lib/auth/validation";
import type { AuthFieldErrors } from "./auth-form-types";

function values(formData: FormData, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [name, formData.get(name) ?? ""]),
  );
}

function errors(
  result: ReturnType<typeof loginInputSchema.safeParse>,
): AuthFieldErrors {
  return result.success ? {} : authFieldErrors(result.error);
}

export function validateLoginForm(formData: FormData): AuthFieldErrors {
  return errors(
    loginInputSchema.safeParse(values(formData, ["login", "password"])),
  );
}

export function validateRegistrationForm(formData: FormData): AuthFieldErrors {
  const result = registrationInputSchema.safeParse(
    values(formData, ["login", "displayName", "password", "repeatPassword"]),
  );
  return result.success ? {} : authFieldErrors(result.error);
}

export function validatePasswordChangeForm(
  formData: FormData,
): AuthFieldErrors {
  const result = changePasswordInputSchema.safeParse(
    values(formData, ["currentPassword", "newPassword", "repeatPassword"]),
  );
  return result.success ? {} : authFieldErrors(result.error);
}

import { StatusMessage } from "@/components/ui";
import type { AuthActionResult } from "@/features/auth/auth-form-types";

export function AuthFormMessage({
  result,
  successMessage,
}: {
  result?: AuthActionResult | undefined;
  successMessage?: string | undefined;
}) {
  if (!result) return null;
  if (result.ok) {
    return successMessage ? (
      <StatusMessage tone="positive">{successMessage}</StatusMessage>
    ) : null;
  }
  if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
    return null;
  }
  return <StatusMessage tone="negative">{result.message}</StatusMessage>;
}

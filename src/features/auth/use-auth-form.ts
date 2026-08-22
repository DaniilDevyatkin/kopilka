"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { clearOfflineSnapshot } from "@/lib/pwa/offline-snapshot";
import type {
  AuthAction,
  AuthActionResult,
  AuthFieldErrors,
  LogoutAction,
} from "./auth-form-types";

interface AuthFormState {
  attempt: number;
  result?: AuthActionResult;
}

const INITIAL_STATE: AuthFormState = { attempt: 0 };

const NETWORK_FAILURE: AuthActionResult = {
  ok: false,
  code: "INVALID_INPUT",
  message:
    "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
};

export function useAuthForm({
  action,
  validate,
  navigateOnSuccess = true,
}: {
  action: AuthAction;
  validate: (formData: FormData) => AuthFieldErrors;
  navigateOnSuccess?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (
      previous: AuthFormState,
      formData: FormData,
    ): Promise<AuthFormState> => {
      const fieldErrors = validate(formData);
      if (Object.keys(fieldErrors).length > 0) {
        return {
          attempt: previous.attempt + 1,
          result: {
            ok: false,
            code: "INVALID_INPUT",
            message: "Проверьте выделенные поля.",
            fieldErrors,
          },
        };
      }

      try {
        const result = await action(formData);
        if (result.ok && navigateOnSuccess) {
          router.replace(result.nextPath);
          router.refresh();
        }
        return { attempt: previous.attempt + 1, result };
      } catch {
        return { attempt: previous.attempt + 1, result: NETWORK_FAILURE };
      }
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (!state.result || state.result.ok || !state.result.fieldErrors) return;
    formRef.current
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  }, [state.attempt, state.result]);

  return { formRef, formAction, pending, result: state.result };
}

export function useLogout(action: LogoutAction) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: AuthFormState): Promise<AuthFormState> => {
      try {
        const result = await action();
        if (result.ok) {
          await clearOfflineSnapshot();
          router.replace(result.nextPath);
          router.refresh();
        }
        return { attempt: previous.attempt + 1, result };
      } catch {
        return { attempt: previous.attempt + 1, result: NETWORK_FAILURE };
      }
    },
    INITIAL_STATE,
  );
  return { formAction, pending, result: state.result };
}

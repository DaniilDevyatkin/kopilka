"use server";

import "server-only";

import { randomUUID } from "node:crypto";

import { cookies, headers } from "next/headers";

import type { AuthActionResult } from "@/features/auth/auth-form-types";
import {
  authFieldErrors,
  changePasswordInputSchema,
  loginInputSchema,
  registrationInputSchema,
} from "@/lib/auth/validation";
import { getServerEnvironment } from "@/lib/env/server";
import { AuthError } from "@/server/auth/errors";
import { authService } from "@/server/auth/index";
import { authLogger } from "@/server/auth/logger";
import { assertSameOrigin, SameOriginError } from "@/server/auth/same-origin";
import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { getTrustedNetworkIdentifier } from "@/server/auth/trusted-proxy";

function formFields(
  formData: FormData,
  names: readonly string[],
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(
    names.map((name) => [name, formData.get(name) ?? ""]),
  );
}

function invalidFields(
  error: Parameters<typeof authFieldErrors>[0],
): AuthActionResult {
  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Проверьте выделенные поля.",
    fieldErrors: authFieldErrors(error),
  };
}

async function mutationContext() {
  const requestHeaders = await headers();
  const environment = getServerEnvironment();
  assertSameOrigin(requestHeaders, environment.APP_ORIGIN);

  return {
    requestId: randomUUID(),
    networkIdentifier: getTrustedNetworkIdentifier(
      requestHeaders,
      environment.TRUST_PROXY_HEADERS,
    ),
  };
}

function sanitizedFailure(error: unknown, requestId: string): AuthActionResult {
  if (error instanceof AuthError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (error instanceof SameOriginError) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Не удалось подтвердить запрос.",
    };
  }
  authLogger.warn("unexpected_auth_error", { requestId });
  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Не удалось выполнить запрос.",
  };
}

async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}

async function setSessionCookie(rawToken: string): Promise<void> {
  (await cookies()).set(
    SESSION_COOKIE_NAME,
    rawToken,
    getSessionCookieOptions(process.env.NODE_ENV),
  );
}

async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(process.env.NODE_ENV),
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function registerAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const requestId = randomUUID();
  try {
    const context = await mutationContext();
    const fields = formFields(formData, [
      "login",
      "displayName",
      "password",
      "repeatPassword",
    ]);
    const validation = registrationInputSchema.safeParse(fields);
    if (!validation.success) return invalidFields(validation.error);
    const result = await authService.register(fields, {
      ...context,
      currentSessionToken: await currentToken(),
    });
    await setSessionCookie(result.session.rawToken);
    return { ok: true, nextPath: "/onboarding" };
  } catch (error) {
    return sanitizedFailure(error, requestId);
  }
}

export async function loginAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const requestId = randomUUID();
  try {
    const context = await mutationContext();
    const fields = formFields(formData, ["login", "password"]);
    const validation = loginInputSchema.safeParse(fields);
    if (!validation.success) return invalidFields(validation.error);
    const result = await authService.login(fields, {
      ...context,
      currentSessionToken: await currentToken(),
    });
    await setSessionCookie(result.session.rawToken);
    return {
      ok: true,
      nextPath: result.user.onboardingCompleted ? "/app/home" : "/onboarding",
    };
  } catch (error) {
    return sanitizedFailure(error, requestId);
  }
}

export async function logoutAction(): Promise<AuthActionResult> {
  const requestId = randomUUID();
  try {
    await mutationContext();
    await authService.logout(await currentToken());
    await clearSessionCookie();
    return { ok: true, nextPath: "/login" };
  } catch (error) {
    return sanitizedFailure(error, requestId);
  }
}

export async function changePasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const requestId = randomUUID();
  try {
    const context = await mutationContext();
    const fields = formFields(formData, [
      "currentPassword",
      "newPassword",
      "repeatPassword",
    ]);
    const validation = changePasswordInputSchema.safeParse(fields);
    if (!validation.success) return invalidFields(validation.error);
    const result = await authService.changePassword(
      await currentToken(),
      fields,
      context,
    );
    await setSessionCookie(result.session.rawToken);
    return { ok: true, nextPath: "/app/profile" };
  } catch (error) {
    return sanitizedFailure(error, requestId);
  }
}

"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { CategoryError } from "@/server/categories/errors";
import { OperationError } from "@/server/operations/errors";
import { operationService } from "@/server/operations/index";
import type {
  CancelOperationInput,
  CancelOperationResult,
  CreateOperationInput,
  CreateOperationResult,
  EditOperationInput,
  EditOperationResult,
} from "@/server/operations/service";

export type OperationActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof OperationError || error instanceof CategoryError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (error instanceof SameOriginError) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Не удалось подтвердить запрос.",
    };
  }
  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Не удалось выполнить запрос.",
  };
}

export async function editOperationAction(
  input: EditOperationInput,
): Promise<OperationActionResult<EditOperationResult>> {
  try {
    assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
    return {
      ok: true,
      data: await operationService.editOperation(
        (await requireAuthenticatedUser()).id,
        input,
      ),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function cancelOperationAction(
  input: CancelOperationInput,
): Promise<OperationActionResult<CancelOperationResult>> {
  try {
    assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
    return {
      ok: true,
      data: await operationService.cancelOperation(
        (await requireAuthenticatedUser()).id,
        input,
      ),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function createOperationAction(
  input: CreateOperationInput,
): Promise<OperationActionResult<CreateOperationResult>> {
  try {
    const requestHeaders = await headers();
    assertSameOrigin(requestHeaders, getServerEnvironment().APP_ORIGIN);
    const userId = (await requireAuthenticatedUser()).id;
    return {
      ok: true,
      data: await operationService.createOperation(userId, input),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

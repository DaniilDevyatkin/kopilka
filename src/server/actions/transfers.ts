"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import {
  cancelTransferForCurrentUser,
  createTransferForCurrentUser,
  editTransferForCurrentUser,
} from "@/server/transfers/current-user";
import { TransferError } from "@/server/transfers/errors";
import type {
  CancelTransferInput,
  CancelTransferResult,
  CreateTransferInput,
  CreateTransferResult,
  EditTransferInput,
  EditTransferResult,
} from "@/server/transfers/service";

export type TransferActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof TransferError) {
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
    message: "Не удалось выполнить перевод.",
  };
}

async function assertMutationSameOrigin(): Promise<void> {
  assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
}

export async function createTransferAction(
  input: CreateTransferInput,
): Promise<TransferActionResult<CreateTransferResult>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await createTransferForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function editTransferAction(
  input: EditTransferInput,
): Promise<TransferActionResult<EditTransferResult>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await editTransferForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function cancelTransferAction(
  input: CancelTransferInput,
): Promise<TransferActionResult<CancelTransferResult>> {
  try {
    await assertMutationSameOrigin();
    return { ok: true, data: await cancelTransferForCurrentUser(input) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

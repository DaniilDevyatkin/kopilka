"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import {
  toClientAccount,
  toClientAccountDetail,
  toClientReconcileResult,
  type ClientAccount,
  type ClientAccountDetail,
  type ClientReconcileResult,
} from "@/lib/accounts/dto";
import { accountService } from "@/server/accounts/index";
import { AccountError } from "@/server/accounts/errors";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import type {
  CreateAccountInput,
  ReconcileAccountInput,
  UpdateAccountInput,
} from "@/server/accounts/service";

export type AccountsActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof AccountError) {
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

async function assertMutationSameOrigin(): Promise<void> {
  assertSameOrigin(await headers(), getServerEnvironment().APP_ORIGIN);
}

export async function listAccountsAction(): Promise<
  AccountsActionResult<ClientAccount[]>
> {
  try {
    const userId = (await requireAuthenticatedUser()).id;
    const accounts = await accountService.listAccounts(userId);
    return { ok: true, data: accounts.map(toClientAccount) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function getAccountDetailAction(
  accountId: string,
): Promise<AccountsActionResult<ClientAccountDetail>> {
  try {
    const userId = (await requireAuthenticatedUser()).id;
    const detail = await accountService.getAccountDetail(userId, accountId);
    return { ok: true, data: toClientAccountDetail(detail) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function createAccountAction(
  input: CreateAccountInput,
): Promise<AccountsActionResult<ClientAccount>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    const result = await accountService.createAccount(userId, input);
    return { ok: true, data: toClientAccount(result.account) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function updateAccountAction(
  input: UpdateAccountInput,
): Promise<AccountsActionResult<ClientAccount>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    const account = await accountService.updateAccount(userId, input);
    return { ok: true, data: toClientAccount(account) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function archiveAccountAction(
  accountId: string,
): Promise<AccountsActionResult<ClientAccount>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    const account = await accountService.archiveAccount(userId, accountId);
    return { ok: true, data: toClientAccount(account) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function deleteAccountAction(
  accountId: string,
): Promise<AccountsActionResult<null>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    await accountService.deleteAccount(userId, accountId);
    return { ok: true, data: null };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function reconcileAccountAction(
  input: ReconcileAccountInput,
): Promise<AccountsActionResult<ClientReconcileResult>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    const result = await accountService.reconcileAccount(userId, input);
    return { ok: true, data: toClientReconcileResult(result) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

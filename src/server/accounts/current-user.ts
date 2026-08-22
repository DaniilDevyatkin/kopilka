import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { accountService } from "@/server/accounts/index";
import type {
  CreateAccountInput,
  ReconcileAccountInput,
  UpdateAccountInput,
} from "@/server/accounts/service";

async function authenticatedUserId(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}

export async function createAccountForCurrentUser(input: CreateAccountInput) {
  return accountService.createAccount(await authenticatedUserId(), input);
}

export async function getAccountForCurrentUser(accountId: string) {
  return accountService.getAccount(await authenticatedUserId(), accountId);
}

export async function getAccountMonthFlowForCurrentUser(
  accountId: string,
  month: string,
) {
  return accountService.getMonthFlow(
    await authenticatedUserId(),
    accountId,
    month,
  );
}

export async function getTotalCapitalForCurrentUser() {
  return accountService.getTotalCapital(await authenticatedUserId());
}

export async function listAccountsForCurrentUser() {
  return accountService.listAccounts(await authenticatedUserId());
}

export async function getAccountDetailForCurrentUser(accountId: string) {
  return accountService.getAccountDetail(
    await authenticatedUserId(),
    accountId,
  );
}

export async function updateAccountForCurrentUser(input: UpdateAccountInput) {
  return accountService.updateAccount(await authenticatedUserId(), input);
}

export async function archiveAccountForCurrentUser(accountId: string) {
  return accountService.archiveAccount(await authenticatedUserId(), accountId);
}

export async function deleteAccountForCurrentUser(accountId: string) {
  return accountService.deleteAccount(await authenticatedUserId(), accountId);
}

export async function reconcileAccountForCurrentUser(
  input: ReconcileAccountInput,
) {
  return accountService.reconcileAccount(await authenticatedUserId(), input);
}

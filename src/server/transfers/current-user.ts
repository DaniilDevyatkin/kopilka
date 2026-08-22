import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import type {
  CancelTransferInput,
  CreateTransferInput,
  EditTransferInput,
} from "@/server/transfers/service";
import { transferService } from "@/server/transfers/index";

async function authenticatedUserId(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}

export async function createTransferForCurrentUser(input: CreateTransferInput) {
  return transferService.createTransfer(await authenticatedUserId(), input);
}

export async function editTransferForCurrentUser(input: EditTransferInput) {
  return transferService.editTransfer(await authenticatedUserId(), input);
}

export async function cancelTransferForCurrentUser(input: CancelTransferInput) {
  return transferService.cancelTransfer(await authenticatedUserId(), input);
}

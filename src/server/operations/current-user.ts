import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { operationService } from "@/server/operations/index";
import type { CreateOperationInput } from "@/server/operations/service";

export async function createOperationForCurrentUser(
  input: CreateOperationInput,
) {
  return operationService.createOperation(
    (await requireAuthenticatedUser()).id,
    input,
  );
}

import "server-only";

import { createHash } from "node:crypto";

import {
  AccountType,
  IdempotencyState,
  LedgerEntryRole,
  OperationType,
  Prisma,
  type Account,
  type Category,
  type PrismaClient,
} from "@/generated/prisma/client";
import { OperationError } from "@/server/operations/errors";
import {
  cancelOperationInputSchema,
  createOperationInputSchema,
  editOperationInputSchema,
  type CancelOperationInput,
  type CreateOperationInput,
  type EditOperationInput,
  type ParsedCreateOperationInput,
} from "@/server/operations/validation";

type OperationDatabase = PrismaClient | Prisma.TransactionClient;

type ResolveOperationCategory = (
  database: OperationDatabase,
  userId: string,
  kindInput: unknown,
  categoryIdInput: unknown,
) => Promise<Category>;

interface OperationServiceDependencies {
  database: PrismaClient;
  resolveOperationCategory: ResolveOperationCategory;
  now?: () => Date;
}

interface FinancialState {
  balanceMinor: bigint;
  reservedMinor: bigint;
}

export interface OperationReadModel {
  id: string;
  type: OperationType;
  categoryId: string;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  accountId: string;
  amountMinor: bigint;
}

export interface CreateOperationResult {
  operation: OperationReadModel;
  replayed: boolean;
}
export interface EditOperationResult {
  operation: OperationReadModel;
  reversalOperationId: string;
  replayed: boolean;
}
export interface CancelOperationResult {
  cancelledOperationId: string;
  reversalOperationId: string;
  replayed: boolean;
}

const OPERATION_CREATE_SCOPE = "operation.create";
const OPERATION_EDIT_SCOPE = "operation.edit";
const OPERATION_CANCEL_SCOPE = "operation.cancel";
const MAX_TRANSACTION_ATTEMPTS = 3;
// ponytail: fixed documented horizon; revisit if backdated imports or scheduling are introduced
const FUTURE_HORIZON_MS = 31 * 86_400_000;
const PAST_HORIZON_MS = 366 * 86_400_000;

function errorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

function requestHash(scope: string, values: readonly unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify([scope, ...values]))
    .digest("hex");
}

function assertParsed<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) throw new OperationError("INVALID_INPUT");
  return result.data;
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OperationError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

function createResultFromJson(value: Prisma.JsonValue | null): {
  operationId: string;
} {
  const result = jsonObject(value);
  if (typeof result.operationId !== "string") {
    throw new OperationError("IDEMPOTENCY_CONFLICT");
  }
  return result as unknown as { operationId: string };
}

function assertDateHorizon(value: Date, reference: Date): void {
  const offset = reference.getTime() - value.getTime();
  if (Number.isNaN(value.getTime()) || offset > PAST_HORIZON_MS) {
    throw new OperationError("DATE_OUT_OF_RANGE");
  }
  if (offset < -FUTURE_HORIZON_MS) {
    throw new OperationError("DATE_OUT_OF_RANGE");
  }
}

async function runSerializable<T>(
  database: PrismaClient,
  command: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(command, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        errorCode(error) !== "P2034" ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw new Error("Unreachable transaction retry state.");
}

async function lockOwnedAccount(
  database: OperationDatabase,
  userId: string,
  accountId: string,
): Promise<Account> {
  const rows = await database.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "accounts"
    WHERE "id" = ${accountId}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw new OperationError("ACCOUNT_NOT_FOUND");
  const account = await database.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new OperationError("ACCOUNT_NOT_FOUND");
  return account;
}

async function financialState(
  database: OperationDatabase,
  userId: string,
  accountId: string,
): Promise<FinancialState> {
  const [ledger, reservations] = await Promise.all([
    database.ledgerEntry.aggregate({
      where: { userId, accountId },
      _sum: { amountMinor: true },
    }),
    database.goalReservationEntry.aggregate({
      where: { userId, sourceAccountId: accountId },
      _sum: { amountMinor: true },
    }),
  ]);
  return {
    balanceMinor: ledger._sum.amountMinor ?? 0n,
    reservedMinor: reservations._sum.amountMinor ?? 0n,
  };
}

function assertFinancialFloor(account: Account, state: FinancialState): void {
  if (account.type === AccountType.CREDIT_CARD) {
    if (state.balanceMinor < -(account.creditLimitMinor ?? 0n)) {
      throw new OperationError("CREDIT_LIMIT_EXCEEDED");
    }
    if (
      state.reservedMinor > (state.balanceMinor > 0n ? state.balanceMinor : 0n)
    ) {
      throw new OperationError("INSUFFICIENT_AVAILABLE_FUNDS");
    }
    return;
  }
  if (state.balanceMinor - state.reservedMinor < 0n) {
    throw new OperationError("INSUFFICIENT_AVAILABLE_FUNDS");
  }
}

async function operationReadModel(
  database: OperationDatabase,
  userId: string,
  operationId: string,
): Promise<OperationReadModel> {
  const operation = await database.financialOperation.findFirst({
    where: { id: operationId, userId },
  });
  if (!operation?.categoryId) throw new OperationError("IDEMPOTENCY_CONFLICT");
  const entry = await database.ledgerEntry.findFirst({
    where: { operationId, userId },
  });
  if (!entry) throw new OperationError("IDEMPOTENCY_CONFLICT");
  return {
    id: operation.id,
    type: operation.type,
    categoryId: operation.categoryId,
    note: operation.note,
    occurredAt: operation.occurredAt,
    createdAt: operation.createdAt,
    accountId: entry.accountId,
    amountMinor: entry.amountMinor,
  };
}

function createPayloadHash(
  input: ParsedCreateOperationInput,
  occurredAt: Date,
): string {
  return requestHash(OPERATION_CREATE_SCOPE, [
    input.kind,
    input.amountMinor.toString(),
    input.accountId.toLowerCase(),
    input.categoryId.toLowerCase(),
    input.comment ?? null,
    occurredAt.toISOString(),
  ]);
}

async function assertIdempotencyRecord(
  database: OperationDatabase,
  userId: string,
  scope: string,
  key: string,
  hash: string,
) {
  const existing = await database.idempotencyKey.findUnique({
    where: { userId_scope_key: { userId, scope, key } },
  });
  if (!existing) return null;
  if (existing.requestHash !== hash) {
    throw new OperationError("IDEMPOTENCY_CONFLICT");
  }
  if (existing.state !== IdempotencyState.COMPLETED) {
    throw new OperationError("IDEMPOTENCY_IN_PROGRESS");
  }
  return existing;
}

export function createOperationService(
  dependencies: OperationServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function replayCreate(
    database: OperationDatabase,
    userId: string,
    input: ParsedCreateOperationInput,
    hash: string,
  ): Promise<CreateOperationResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      OPERATION_CREATE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new OperationError("IDEMPOTENCY_CONFLICT");
    const stored = createResultFromJson(record.resultJson);
    if (stored.operationId !== record.resourceId) {
      throw new OperationError("IDEMPOTENCY_CONFLICT");
    }
    return {
      operation: await operationReadModel(database, userId, stored.operationId),
      replayed: true,
    };
  }

  async function createOperation(
    userId: string,
    inputValue: CreateOperationInput,
  ): Promise<CreateOperationResult> {
    const input = assertParsed(
      createOperationInputSchema.safeParse(inputValue),
    );
    const occurredAt = new Date(input.occurredAt);
    const hash = createPayloadHash(input, occurredAt);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      OPERATION_CREATE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) {
      return replayCreate(dependencies.database, userId, input, hash);
    }
    assertDateHorizon(occurredAt, now());
    try {
      return await runSerializable(dependencies.database, async (database) => {
        const existing = await assertIdempotencyRecord(
          database,
          userId,
          OPERATION_CREATE_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (existing) return replayCreate(database, userId, input, hash);

        await database.idempotencyKey.create({
          data: {
            userId,
            scope: OPERATION_CREATE_SCOPE,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: now(),
          },
        });
        const account = await lockOwnedAccount(
          database,
          userId,
          input.accountId,
        );
        if (account.archivedAt) throw new OperationError("ACCOUNT_ARCHIVED");
        const category = await dependencies.resolveOperationCategory(
          database,
          userId,
          input.kind,
          input.categoryId,
        );
        const state = await financialState(database, userId, account.id);
        const amountMinor =
          input.kind === "INCOME" ? input.amountMinor : -input.amountMinor;
        assertFinancialFloor(account, {
          balanceMinor: state.balanceMinor + amountMinor,
          reservedMinor: state.reservedMinor,
        });

        const operation = await database.financialOperation.create({
          data: {
            userId,
            type:
              input.kind === "INCOME"
                ? OperationType.INCOME
                : OperationType.EXPENSE,
            categoryId: category.id,
            note: input.comment?.trim() || null,
            occurredAt,
          },
        });
        await database.ledgerEntry.create({
          data: {
            userId,
            operationId: operation.id,
            accountId: account.id,
            amountMinor,
            role: LedgerEntryRole.PRIMARY,
          },
        });

        await database.idempotencyKey.update({
          where: {
            userId_scope_key: {
              userId,
              scope: OPERATION_CREATE_SCOPE,
              key: input.idempotencyKey,
            },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "operation",
            resourceId: operation.id,
            resultJson: { operationId: operation.id },
            completedAt: now(),
          },
        });
        return {
          operation: await operationReadModel(database, userId, operation.id),
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayCreate(dependencies.database, userId, input, hash);
      }
      throw error;
    }
  }

  async function lifecycleRecord(
    userId: string,
    scope: string,
    key: string,
    hash: string,
  ): Promise<Prisma.JsonObject> {
    const record = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      scope,
      key,
      hash,
    );
    if (!record?.resultJson) throw new OperationError("IDEMPOTENCY_CONFLICT");
    return jsonObject(record.resultJson);
  }

  async function replayEdit(
    userId: string,
    key: string,
    hash: string,
  ): Promise<EditOperationResult> {
    const result = await lifecycleRecord(
      userId,
      OPERATION_EDIT_SCOPE,
      key,
      hash,
    );
    if (
      typeof result.operationId !== "string" ||
      typeof result.reversalOperationId !== "string"
    )
      throw new OperationError("IDEMPOTENCY_CONFLICT");
    return {
      operation: await operationReadModel(
        dependencies.database,
        userId,
        result.operationId,
      ),
      reversalOperationId: result.reversalOperationId,
      replayed: true,
    };
  }

  async function replayCancel(
    userId: string,
    key: string,
    hash: string,
  ): Promise<CancelOperationResult> {
    const result = await lifecycleRecord(
      userId,
      OPERATION_CANCEL_SCOPE,
      key,
      hash,
    );
    if (
      typeof result.cancelledOperationId !== "string" ||
      typeof result.reversalOperationId !== "string"
    )
      throw new OperationError("IDEMPOTENCY_CONFLICT");
    return {
      cancelledOperationId: result.cancelledOperationId,
      reversalOperationId: result.reversalOperationId,
      replayed: true,
    };
  }

  async function lockOriginal(
    database: OperationDatabase,
    userId: string,
    operationId: string,
  ) {
    const rows = await database.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "financial_operations"
      WHERE "id" = ${operationId}::uuid AND "userId" = ${userId}::uuid
      FOR UPDATE
    `;
    if (!rows.length) throw new OperationError("OPERATION_NOT_FOUND");
    const operation = await database.financialOperation.findFirst({
      where: { id: operationId, userId },
      include: {
        ledgerEntries: true,
        reversedBy: { select: { id: true } },
        supersededBy: { select: { id: true } },
      },
    });
    if (!operation) throw new OperationError("OPERATION_NOT_FOUND");
    if (
      (operation.type !== OperationType.INCOME &&
        operation.type !== OperationType.EXPENSE) ||
      operation.ledgerEntries.length !== 1 ||
      operation.reversedBy ||
      operation.supersededBy.length
    ) {
      throw new OperationError("OPERATION_IMMUTABLE");
    }
    return { operation, entry: operation.ledgerEntries[0]! };
  }

  async function assertDeltas(
    database: OperationDatabase,
    userId: string,
    accountIds: string[],
    deltas: Map<string, bigint>,
  ) {
    const accounts = new Map<string, Account>();
    for (const accountId of [...new Set(accountIds)].sort()) {
      accounts.set(
        accountId,
        await lockOwnedAccount(database, userId, accountId),
      );
    }
    for (const [accountId, delta] of deltas) {
      const account = accounts.get(accountId);
      if (!account) throw new OperationError("ACCOUNT_NOT_FOUND");
      const state = await financialState(database, userId, accountId);
      assertFinancialFloor(account, {
        balanceMinor: state.balanceMinor + delta,
        reservedMinor: state.reservedMinor,
      });
    }
    return accounts;
  }

  async function createReversal(
    database: OperationDatabase,
    userId: string,
    originalId: string,
    accountId: string,
    amountMinor: bigint,
    occurredAt: Date,
  ) {
    const reversal = await database.financialOperation.create({
      data: {
        userId,
        type: OperationType.REVERSAL,
        occurredAt,
        note: "Отмена операции",
        reversesOperationId: originalId,
      },
    });
    await database.ledgerEntry.create({
      data: {
        userId,
        operationId: reversal.id,
        accountId,
        amountMinor: -amountMinor,
        role: LedgerEntryRole.REVERSAL,
      },
    });
    return reversal;
  }

  async function editOperation(
    userId: string,
    inputValue: EditOperationInput,
  ): Promise<EditOperationResult> {
    const input = assertParsed(editOperationInputSchema.safeParse(inputValue));
    const occurredAt = new Date(input.occurredAt);
    assertDateHorizon(occurredAt, now());
    const hash = requestHash(OPERATION_EDIT_SCOPE, [
      input.operationId,
      input.kind,
      input.amountMinor.toString(),
      input.accountId,
      input.categoryId,
      input.comment ?? null,
      occurredAt.toISOString(),
    ]);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      OPERATION_EDIT_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) return replayEdit(userId, input.idempotencyKey, hash);
    try {
      return await runSerializable(dependencies.database, async (database) => {
        const replay = await assertIdempotencyRecord(
          database,
          userId,
          OPERATION_EDIT_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (replay) return replayEdit(userId, input.idempotencyKey, hash);
        await database.idempotencyKey.create({
          data: {
            userId,
            scope: OPERATION_EDIT_SCOPE,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: now(),
          },
        });
        const original = await lockOriginal(
          database,
          userId,
          input.operationId,
        );
        const newSignedAmount =
          input.kind === "INCOME" ? input.amountMinor : -input.amountMinor;
        const deltas = new Map<string, bigint>();
        deltas.set(original.entry.accountId, -original.entry.amountMinor);
        deltas.set(
          input.accountId,
          (deltas.get(input.accountId) ?? 0n) + newSignedAmount,
        );
        const accounts = await assertDeltas(
          database,
          userId,
          [original.entry.accountId, input.accountId],
          deltas,
        );
        const targetAccount = accounts.get(input.accountId)!;
        if (targetAccount.archivedAt)
          throw new OperationError("ACCOUNT_ARCHIVED");
        const category = await dependencies.resolveOperationCategory(
          database,
          userId,
          input.kind,
          input.categoryId,
        );
        const reversal = await createReversal(
          database,
          userId,
          original.operation.id,
          original.entry.accountId,
          original.entry.amountMinor,
          occurredAt,
        );
        const replacement = await database.financialOperation.create({
          data: {
            userId,
            type:
              input.kind === "INCOME"
                ? OperationType.INCOME
                : OperationType.EXPENSE,
            categoryId: category.id,
            note: input.comment?.trim() || null,
            occurredAt,
            supersedesOperationId: original.operation.id,
          },
        });
        await database.ledgerEntry.create({
          data: {
            userId,
            operationId: replacement.id,
            accountId: input.accountId,
            amountMinor: newSignedAmount,
            role: LedgerEntryRole.PRIMARY,
          },
        });
        const result: EditOperationResult = {
          operation: await operationReadModel(database, userId, replacement.id),
          reversalOperationId: reversal.id,
          replayed: false,
        };
        await database.idempotencyKey.update({
          where: {
            userId_scope_key: {
              userId,
              scope: OPERATION_EDIT_SCOPE,
              key: input.idempotencyKey,
            },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "operation",
            resourceId: replacement.id,
            resultJson: {
              operationId: replacement.id,
              reversalOperationId: reversal.id,
            },
            completedAt: now(),
          },
        });
        return result;
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayEdit(userId, input.idempotencyKey, hash);
      }
      throw error;
    }
  }

  async function cancelOperation(
    userId: string,
    inputValue: CancelOperationInput,
  ): Promise<CancelOperationResult> {
    const input = assertParsed(
      cancelOperationInputSchema.safeParse(inputValue),
    );
    const occurredAt = new Date(input.occurredAt);
    assertDateHorizon(occurredAt, now());
    const hash = requestHash(OPERATION_CANCEL_SCOPE, [
      input.operationId,
      occurredAt.toISOString(),
    ]);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      OPERATION_CANCEL_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) return replayCancel(userId, input.idempotencyKey, hash);
    try {
      return await runSerializable(dependencies.database, async (database) => {
        const replay = await assertIdempotencyRecord(
          database,
          userId,
          OPERATION_CANCEL_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (replay) return replayCancel(userId, input.idempotencyKey, hash);
        await database.idempotencyKey.create({
          data: {
            userId,
            scope: OPERATION_CANCEL_SCOPE,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: now(),
          },
        });
        const original = await lockOriginal(
          database,
          userId,
          input.operationId,
        );
        await assertDeltas(
          database,
          userId,
          [original.entry.accountId],
          new Map([[original.entry.accountId, -original.entry.amountMinor]]),
        );
        const reversal = await createReversal(
          database,
          userId,
          original.operation.id,
          original.entry.accountId,
          original.entry.amountMinor,
          occurredAt,
        );
        const result: CancelOperationResult = {
          cancelledOperationId: original.operation.id,
          reversalOperationId: reversal.id,
          replayed: false,
        };
        await database.idempotencyKey.update({
          where: {
            userId_scope_key: {
              userId,
              scope: OPERATION_CANCEL_SCOPE,
              key: input.idempotencyKey,
            },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "operation",
            resourceId: reversal.id,
            resultJson: {
              cancelledOperationId: result.cancelledOperationId,
              reversalOperationId: result.reversalOperationId,
            },
            completedAt: now(),
          },
        });
        return result;
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayCancel(userId, input.idempotencyKey, hash);
      }
      throw error;
    }
  }

  return { createOperation, editOperation, cancelOperation };
}

export type OperationService = ReturnType<typeof createOperationService>;
export type { CancelOperationInput, CreateOperationInput, EditOperationInput };

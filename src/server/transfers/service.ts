import "server-only";

import { createHash } from "node:crypto";

import {
  AccountType,
  IdempotencyState,
  LedgerEntryRole,
  OperationType,
  Prisma,
  type Account,
  type FinancialOperation,
  type LedgerEntry,
  type PrismaClient,
} from "@/generated/prisma/client";
import { TransferError } from "@/server/transfers/errors";
import {
  cancelTransferInputSchema,
  createTransferInputSchema,
  editTransferInputSchema,
  type CancelTransferInput,
  type CreateTransferInput,
  type EditTransferInput,
  type ParsedCancelTransferInput,
  type ParsedCreateTransferInput,
  type ParsedEditTransferInput,
} from "@/server/transfers/validation";

type TransferDatabase = PrismaClient | Prisma.TransactionClient;

interface TransferServiceDependencies {
  database: PrismaClient;
  now?: () => Date;
}

interface FinancialState {
  balanceMinor: bigint;
  reservedMinor: bigint;
}

interface TransferPair {
  source: LedgerEntry;
  destination: LedgerEntry;
}

interface LockedTransfer {
  operation: FinancialOperation;
  pair: TransferPair;
}

export interface TransferEntryReadModel {
  accountId: string;
  amountMinor: bigint;
  role: LedgerEntryRole;
}

export interface TransferReadModel {
  id: string;
  type: typeof OperationType.TRANSFER;
  sourceAccountId: string;
  destinationAccountId: string;
  amountMinor: bigint;
  note: string | null;
  occurredAt: Date;
  createdAt: Date;
  supersedesOperationId: string | null;
  entries: readonly [TransferEntryReadModel, TransferEntryReadModel];
}

export interface CreateTransferResult {
  transfer: TransferReadModel;
  replayed: boolean;
}

export interface EditTransferResult {
  transfer: TransferReadModel;
  reversalOperationId: string;
  replayed: boolean;
}

export interface CancelTransferResult {
  cancelledTransferId: string;
  reversalOperationId: string;
  replayed: boolean;
}

const CREATE_SCOPE = "transfer.create";
const EDIT_SCOPE = "transfer.edit";
const CANCEL_SCOPE = "transfer.cancel";
const MAX_TRANSACTION_ATTEMPTS = 3;
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

function databaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "meta" in error &&
    typeof error.meta === "object" &&
    error.meta !== null
  ) {
    const meta = error.meta as {
      code?: unknown;
      driverAdapterError?: { cause?: { originalCode?: unknown } };
    };
    if (typeof meta.code === "string") return meta.code;
    const originalCode = meta.driverAdapterError?.cause?.originalCode;
    return typeof originalCode === "string" ? originalCode : undefined;
  }
  return undefined;
}

function isRetryableTransactionError(error: unknown): boolean {
  if (errorCode(error) === "P2034") return true;
  const sqlState = databaseErrorCode(error);
  return sqlState === "40001" || sqlState === "40P01";
}

function assertParsed<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) throw new TransferError("INVALID_INPUT");
  return result.data;
}

function requestHash(scope: string, values: readonly unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify([scope, ...values]))
    .digest("hex");
}

function canonicalTransferHash(
  scope: string,
  input: ParsedCreateTransferInput,
  occurredAt: Date,
  transferId?: string,
): string {
  return requestHash(scope, [
    transferId?.toLowerCase() ?? null,
    input.amountMinor.toString(),
    input.sourceAccountId.toLowerCase(),
    input.destinationAccountId.toLowerCase(),
    input.comment ?? null,
    occurredAt.toISOString(),
  ]);
}

function canonicalCancelHash(
  input: ParsedCancelTransferInput,
  occurredAt: Date,
): string {
  return requestHash(CANCEL_SCOPE, [
    input.transferId.toLowerCase(),
    input.comment ?? null,
    occurredAt.toISOString(),
  ]);
}

function assertDateHorizon(value: Date, reference: Date): void {
  const offset = reference.getTime() - value.getTime();
  if (Number.isNaN(value.getTime()) || offset > PAST_HORIZON_MS) {
    throw new TransferError("DATE_OUT_OF_RANGE");
  }
  if (offset < -FUTURE_HORIZON_MS) {
    throw new TransferError("DATE_OUT_OF_RANGE");
  }
}

function assertDifferentAccounts(
  sourceAccountId: string,
  destinationAccountId: string,
): void {
  if (sourceAccountId.toLowerCase() === destinationAccountId.toLowerCase()) {
    throw new TransferError("SAME_ACCOUNT");
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
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw new Error("Unreachable transaction retry state.");
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TransferError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

function requiredJsonString(object: Prisma.JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new TransferError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

async function assertIdempotencyRecord(
  database: TransferDatabase,
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
    throw new TransferError("IDEMPOTENCY_CONFLICT");
  }
  if (existing.state !== IdempotencyState.COMPLETED) {
    throw new TransferError("IDEMPOTENCY_IN_PROGRESS");
  }
  return existing;
}

function assertTransferPair(entries: readonly LedgerEntry[]): TransferPair {
  if (entries.length !== 2) {
    throw new TransferError("TRANSFER_INTEGRITY_ERROR");
  }
  const source = entries.find(
    (entry) => entry.role === LedgerEntryRole.TRANSFER_SOURCE,
  );
  const destination = entries.find(
    (entry) => entry.role === LedgerEntryRole.TRANSFER_DESTINATION,
  );
  if (
    !source ||
    !destination ||
    source.amountMinor >= 0n ||
    destination.amountMinor <= 0n ||
    source.amountMinor + destination.amountMinor !== 0n ||
    source.accountId === destination.accountId
  ) {
    throw new TransferError("TRANSFER_INTEGRITY_ERROR");
  }
  return { source, destination };
}

async function transferReadModel(
  database: TransferDatabase,
  userId: string,
  operationId: string,
): Promise<TransferReadModel> {
  const operation = await database.financialOperation.findFirst({
    where: { id: operationId, userId, type: OperationType.TRANSFER },
    include: { ledgerEntries: true },
  });
  if (!operation) throw new TransferError("TRANSFER_NOT_FOUND");
  const pair = assertTransferPair(operation.ledgerEntries);
  return {
    id: operation.id,
    type: OperationType.TRANSFER,
    sourceAccountId: pair.source.accountId,
    destinationAccountId: pair.destination.accountId,
    amountMinor: pair.destination.amountMinor,
    note: operation.note,
    occurredAt: operation.occurredAt,
    createdAt: operation.createdAt,
    supersedesOperationId: operation.supersedesOperationId,
    entries: [
      {
        accountId: pair.source.accountId,
        amountMinor: pair.source.amountMinor,
        role: pair.source.role,
      },
      {
        accountId: pair.destination.accountId,
        amountMinor: pair.destination.amountMinor,
        role: pair.destination.role,
      },
    ],
  };
}

async function lockOwnedTransfer(
  database: Prisma.TransactionClient,
  userId: string,
  transferId: string,
): Promise<LockedTransfer> {
  const rows = await database.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "financial_operations"
    WHERE "id" = ${transferId}::uuid
      AND "userId" = ${userId}::uuid
      AND "type" = 'TRANSFER'
    FOR UPDATE
  `;
  if (rows.length === 0) throw new TransferError("TRANSFER_NOT_FOUND");
  const operation = await database.financialOperation.findFirst({
    where: { id: transferId, userId, type: OperationType.TRANSFER },
    include: {
      ledgerEntries: true,
      reversedBy: { select: { id: true } },
      supersededBy: { select: { id: true } },
    },
  });
  if (!operation) throw new TransferError("TRANSFER_NOT_FOUND");
  if (operation.reversedBy || operation.supersededBy.length > 0) {
    throw new TransferError("TRANSFER_NOT_ACTIVE");
  }
  return {
    operation,
    pair: assertTransferPair(operation.ledgerEntries),
  };
}

async function lockOwnedAccounts(
  database: Prisma.TransactionClient,
  userId: string,
  accountIds: readonly string[],
): Promise<Map<string, Account>> {
  const uniqueIds = [
    ...new Set(accountIds.map((id) => id.toLowerCase())),
  ].sort();
  for (const accountId of uniqueIds) {
    const rows = await database.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "accounts"
      WHERE "id" = ${accountId}::uuid AND "userId" = ${userId}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) throw new TransferError("ACCOUNT_NOT_FOUND");
  }
  const accounts = await database.account.findMany({
    where: { userId, id: { in: uniqueIds } },
  });
  if (accounts.length !== uniqueIds.length) {
    throw new TransferError("ACCOUNT_NOT_FOUND");
  }
  return new Map(accounts.map((account) => [account.id, account]));
}

function requiredAccount(accounts: Map<string, Account>, id: string): Account {
  const account = accounts.get(id.toLowerCase());
  if (!account) throw new TransferError("ACCOUNT_NOT_FOUND");
  return account;
}

function assertActive(account: Account): void {
  if (account.archivedAt) throw new TransferError("ACCOUNT_ARCHIVED");
}

function assertSameCurrency(source: Account, destination: Account): void {
  if (source.currency !== destination.currency) {
    throw new TransferError("CURRENCY_MISMATCH");
  }
}

async function financialState(
  database: TransferDatabase,
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
      throw new TransferError("CREDIT_LIMIT_EXCEEDED");
    }
    if (
      state.reservedMinor > (state.balanceMinor > 0n ? state.balanceMinor : 0n)
    ) {
      throw new TransferError("INSUFFICIENT_AVAILABLE_FUNDS");
    }
    return;
  }
  if (state.balanceMinor - state.reservedMinor < 0n) {
    throw new TransferError("INSUFFICIENT_AVAILABLE_FUNDS");
  }
}

function addDelta(
  deltas: Map<string, bigint>,
  accountId: string,
  value: bigint,
) {
  deltas.set(accountId, (deltas.get(accountId) ?? 0n) + value);
}

async function assertPostDeltas(
  database: TransferDatabase,
  userId: string,
  accounts: Map<string, Account>,
  deltas: Map<string, bigint>,
): Promise<void> {
  const totalDelta = [...deltas.values()].reduce(
    (total, value) => total + value,
    0n,
  );
  if (totalDelta !== 0n) {
    throw new TransferError("TRANSFER_INTEGRITY_ERROR");
  }
  for (const [accountId, delta] of deltas) {
    const account = requiredAccount(accounts, accountId);
    const state = await financialState(database, userId, accountId);
    assertFinancialFloor(account, {
      balanceMinor: state.balanceMinor + delta,
      reservedMinor: state.reservedMinor,
    });
  }
}

async function createTransferRows(
  database: Prisma.TransactionClient,
  userId: string,
  input: ParsedCreateTransferInput,
  occurredAt: Date,
  supersedesOperationId?: string,
): Promise<FinancialOperation> {
  const operation = await database.financialOperation.create({
    data: {
      userId,
      type: OperationType.TRANSFER,
      note: input.comment?.trim() || null,
      occurredAt,
      ...(supersedesOperationId ? { supersedesOperationId } : {}),
    },
  });
  await database.ledgerEntry.createMany({
    data: [
      {
        userId,
        operationId: operation.id,
        accountId: input.sourceAccountId,
        amountMinor: -input.amountMinor,
        role: LedgerEntryRole.TRANSFER_SOURCE,
      },
      {
        userId,
        operationId: operation.id,
        accountId: input.destinationAccountId,
        amountMinor: input.amountMinor,
        role: LedgerEntryRole.TRANSFER_DESTINATION,
      },
    ],
  });
  return operation;
}

async function createTransferReversal(
  database: Prisma.TransactionClient,
  userId: string,
  transfer: LockedTransfer,
  occurredAt: Date,
  note: string | null,
): Promise<FinancialOperation> {
  const reversal = await database.financialOperation.create({
    data: {
      userId,
      type: OperationType.REVERSAL,
      note,
      occurredAt,
      reversesOperationId: transfer.operation.id,
    },
  });
  await database.ledgerEntry.createMany({
    data: [transfer.pair.source, transfer.pair.destination].map((entry) => ({
      userId,
      operationId: reversal.id,
      accountId: entry.accountId,
      amountMinor: -entry.amountMinor,
      role: LedgerEntryRole.REVERSAL,
    })),
  });
  return reversal;
}

async function startIdempotency(
  database: Prisma.TransactionClient,
  userId: string,
  scope: string,
  key: string,
  hash: string,
  createdAt: Date,
): Promise<void> {
  await database.idempotencyKey.create({
    data: { userId, scope, key, requestHash: hash, createdAt },
  });
}

async function completeIdempotency(
  database: Prisma.TransactionClient,
  userId: string,
  scope: string,
  key: string,
  resourceType: string,
  resourceId: string,
  resultJson: Prisma.InputJsonObject,
  completedAt: Date,
): Promise<void> {
  await database.idempotencyKey.update({
    where: { userId_scope_key: { userId, scope, key } },
    data: {
      state: IdempotencyState.COMPLETED,
      resourceType,
      resourceId,
      resultJson,
      completedAt,
    },
  });
}

export function createTransferService(
  dependencies: TransferServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function replayCreate(
    database: TransferDatabase,
    userId: string,
    input: ParsedCreateTransferInput,
    hash: string,
  ): Promise<CreateTransferResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      CREATE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new TransferError("IDEMPOTENCY_CONFLICT");
    const result = jsonObject(record.resultJson);
    const transferOperationId = requiredJsonString(
      result,
      "transferOperationId",
    );
    if (transferOperationId !== record.resourceId) {
      throw new TransferError("IDEMPOTENCY_CONFLICT");
    }
    return {
      transfer: await transferReadModel(database, userId, transferOperationId),
      replayed: true,
    };
  }

  async function createTransfer(
    userId: string,
    inputValue: CreateTransferInput,
  ): Promise<CreateTransferResult> {
    const input = assertParsed(createTransferInputSchema.safeParse(inputValue));
    assertDifferentAccounts(input.sourceAccountId, input.destinationAccountId);
    const occurredAt = new Date(input.occurredAt);
    const hash = canonicalTransferHash(CREATE_SCOPE, input, occurredAt);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      CREATE_SCOPE,
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
          CREATE_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (existing) return replayCreate(database, userId, input, hash);
        await startIdempotency(
          database,
          userId,
          CREATE_SCOPE,
          input.idempotencyKey,
          hash,
          now(),
        );
        const accounts = await lockOwnedAccounts(database, userId, [
          input.sourceAccountId,
          input.destinationAccountId,
        ]);
        const source = requiredAccount(accounts, input.sourceAccountId);
        const destination = requiredAccount(
          accounts,
          input.destinationAccountId,
        );
        assertActive(source);
        assertActive(destination);
        assertSameCurrency(source, destination);

        const deltas = new Map<string, bigint>();
        addDelta(deltas, source.id, -input.amountMinor);
        addDelta(deltas, destination.id, input.amountMinor);
        await assertPostDeltas(database, userId, accounts, deltas);

        const operation = await createTransferRows(
          database,
          userId,
          input,
          occurredAt,
        );
        await completeIdempotency(
          database,
          userId,
          CREATE_SCOPE,
          input.idempotencyKey,
          "transfer",
          operation.id,
          { transferOperationId: operation.id },
          now(),
        );
        return {
          transfer: await transferReadModel(database, userId, operation.id),
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

  async function replayEdit(
    database: TransferDatabase,
    userId: string,
    input: ParsedEditTransferInput,
    hash: string,
  ): Promise<EditTransferResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      EDIT_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record) throw new TransferError("IDEMPOTENCY_CONFLICT");
    const result = jsonObject(record.resultJson);
    const transferOperationId = requiredJsonString(
      result,
      "transferOperationId",
    );
    const reversalOperationId = requiredJsonString(
      result,
      "reversalOperationId",
    );
    if (record.resourceId !== transferOperationId) {
      throw new TransferError("IDEMPOTENCY_CONFLICT");
    }
    return {
      transfer: await transferReadModel(database, userId, transferOperationId),
      reversalOperationId,
      replayed: true,
    };
  }

  async function editTransfer(
    userId: string,
    inputValue: EditTransferInput,
  ): Promise<EditTransferResult> {
    const input = assertParsed(editTransferInputSchema.safeParse(inputValue));
    assertDifferentAccounts(input.sourceAccountId, input.destinationAccountId);
    const occurredAt = new Date(input.occurredAt);
    const hash = canonicalTransferHash(
      EDIT_SCOPE,
      input,
      occurredAt,
      input.transferId,
    );
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      EDIT_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) {
      return replayEdit(dependencies.database, userId, input, hash);
    }
    assertDateHorizon(occurredAt, now());

    try {
      return await runSerializable(dependencies.database, async (database) => {
        const existing = await assertIdempotencyRecord(
          database,
          userId,
          EDIT_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (existing) return replayEdit(database, userId, input, hash);
        await startIdempotency(
          database,
          userId,
          EDIT_SCOPE,
          input.idempotencyKey,
          hash,
          now(),
        );
        const original = await lockOwnedTransfer(
          database,
          userId,
          input.transferId,
        );
        const accounts = await lockOwnedAccounts(database, userId, [
          original.pair.source.accountId,
          original.pair.destination.accountId,
          input.sourceAccountId,
          input.destinationAccountId,
        ]);
        const newSource = requiredAccount(accounts, input.sourceAccountId);
        const newDestination = requiredAccount(
          accounts,
          input.destinationAccountId,
        );
        assertActive(newSource);
        assertActive(newDestination);
        assertSameCurrency(newSource, newDestination);

        const deltas = new Map<string, bigint>();
        addDelta(
          deltas,
          original.pair.source.accountId,
          -original.pair.source.amountMinor,
        );
        addDelta(
          deltas,
          original.pair.destination.accountId,
          -original.pair.destination.amountMinor,
        );
        addDelta(deltas, newSource.id, -input.amountMinor);
        addDelta(deltas, newDestination.id, input.amountMinor);
        await assertPostDeltas(database, userId, accounts, deltas);

        const reversal = await createTransferReversal(
          database,
          userId,
          original,
          occurredAt,
          null,
        );
        const replacement = await createTransferRows(
          database,
          userId,
          input,
          occurredAt,
          original.operation.id,
        );
        await completeIdempotency(
          database,
          userId,
          EDIT_SCOPE,
          input.idempotencyKey,
          "transfer",
          replacement.id,
          {
            transferOperationId: replacement.id,
            reversalOperationId: reversal.id,
          },
          now(),
        );
        return {
          transfer: await transferReadModel(database, userId, replacement.id),
          reversalOperationId: reversal.id,
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayEdit(dependencies.database, userId, input, hash);
      }
      throw error;
    }
  }

  async function replayCancel(
    database: TransferDatabase,
    userId: string,
    input: ParsedCancelTransferInput,
    hash: string,
  ): Promise<CancelTransferResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      CANCEL_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record) throw new TransferError("IDEMPOTENCY_CONFLICT");
    const result = jsonObject(record.resultJson);
    const cancelledTransferId = requiredJsonString(
      result,
      "cancelledTransferId",
    );
    const reversalOperationId = requiredJsonString(
      result,
      "reversalOperationId",
    );
    if (record.resourceId !== reversalOperationId) {
      throw new TransferError("IDEMPOTENCY_CONFLICT");
    }
    return { cancelledTransferId, reversalOperationId, replayed: true };
  }

  async function cancelTransfer(
    userId: string,
    inputValue: CancelTransferInput,
  ): Promise<CancelTransferResult> {
    const input = assertParsed(cancelTransferInputSchema.safeParse(inputValue));
    const occurredAt = new Date(input.occurredAt);
    const hash = canonicalCancelHash(input, occurredAt);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      CANCEL_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) {
      return replayCancel(dependencies.database, userId, input, hash);
    }
    assertDateHorizon(occurredAt, now());

    try {
      return await runSerializable(dependencies.database, async (database) => {
        const existing = await assertIdempotencyRecord(
          database,
          userId,
          CANCEL_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (existing) return replayCancel(database, userId, input, hash);
        await startIdempotency(
          database,
          userId,
          CANCEL_SCOPE,
          input.idempotencyKey,
          hash,
          now(),
        );
        const original = await lockOwnedTransfer(
          database,
          userId,
          input.transferId,
        );
        const accounts = await lockOwnedAccounts(database, userId, [
          original.pair.source.accountId,
          original.pair.destination.accountId,
        ]);
        const deltas = new Map<string, bigint>();
        addDelta(
          deltas,
          original.pair.source.accountId,
          -original.pair.source.amountMinor,
        );
        addDelta(
          deltas,
          original.pair.destination.accountId,
          -original.pair.destination.amountMinor,
        );
        await assertPostDeltas(database, userId, accounts, deltas);

        const reversal = await createTransferReversal(
          database,
          userId,
          original,
          occurredAt,
          input.comment?.trim() || null,
        );
        await completeIdempotency(
          database,
          userId,
          CANCEL_SCOPE,
          input.idempotencyKey,
          "transfer-reversal",
          reversal.id,
          {
            cancelledTransferId: original.operation.id,
            reversalOperationId: reversal.id,
          },
          now(),
        );
        return {
          cancelledTransferId: original.operation.id,
          reversalOperationId: reversal.id,
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayCancel(dependencies.database, userId, input, hash);
      }
      throw error;
    }
  }

  return { createTransfer, editTransfer, cancelTransfer };
}

export type TransferService = ReturnType<typeof createTransferService>;
export type { CancelTransferInput, CreateTransferInput, EditTransferInput };

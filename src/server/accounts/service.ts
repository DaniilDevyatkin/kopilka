import "server-only";

import { createHash, randomInt } from "node:crypto";

import {
  AccountType,
  IdempotencyState,
  LedgerEntryRole,
  OperationType,
  Prisma,
  type Account,
  type PrismaClient,
} from "@/generated/prisma/client";
import { AccountError } from "@/server/accounts/errors";
import {
  accountIdSchema,
  accountMonthSchema,
  createAccountInputSchema,
  reconcileAccountInputSchema,
  updateAccountInputSchema,
  type CreateAccountInput,
  type ParsedCreateAccountInput,
  type ParsedReconcileAccountInput,
  type ReconcileAccountInput,
  type UpdateAccountInput,
} from "@/server/accounts/validation";

type AccountDatabase = PrismaClient | Prisma.TransactionClient;

interface AccountServiceDependencies {
  database: PrismaClient;
  reclaimImage?: (userId: string, imageAssetId: string) => Promise<void>;
  now?: () => Date;
}

interface FinancialState {
  balanceMinor: bigint;
  reservedMinor: bigint;
}

export interface AccountReadModel {
  id: string;
  name: string;
  type: Account["type"];
  currency: Account["currency"];
  visualTheme: string;
  imageAssetId: string | null;
  last4: string | null;
  creditLimitMinor: bigint | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  balanceMinor: bigint;
  reservedMinor: bigint;
  availableMinor: bigint;
  spendingCapacityMinor: bigint;
}

export interface CreateAccountResult {
  account: AccountReadModel;
  openingOperationId: string | null;
  replayed: boolean;
}

export interface ReconcileAccountResult {
  accountId: string;
  operationId: string | null;
  previousBalanceMinor: bigint;
  actualBalanceMinor: bigint;
  deltaMinor: bigint;
  changed: boolean;
  replayed: boolean;
}

export interface AccountDetailTransaction {
  operationId: string;
  type: OperationType;
  note: string | null;
  categoryLabel: string | null;
  categoryIcon: string | null;
  occurredAt: Date;
  amountMinor: bigint;
  role: LedgerEntryRole;
}

export interface AccountBalancePoint {
  /** Local (user time zone) calendar day, YYYY-MM-DD. */
  day: string;
  balanceMinor: bigint;
}

export interface AccountDetailReadModel {
  account: AccountReadModel;
  timeZone: string;
  month: { yearMonth: string; inflowMinor: bigint; outflowMinor: bigint };
  balanceSeries: AccountBalancePoint[];
  recentTransactions: AccountDetailTransaction[];
}

interface CreateIdempotencyResult {
  openingOperationId: string | null;
}

interface ReconcileIdempotencyResult {
  accountId: string;
  operationId: string | null;
  previousBalanceMinor: string;
  actualBalanceMinor: string;
  deltaMinor: string;
  changed: boolean;
}

const CREATE_SCOPE = "account.create";
const RECONCILE_SCOPE = "account.reconcile";
const MAX_TRANSACTION_ATTEMPTS = 3;

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
  if (!result.success) throw new AccountError("INVALID_INPUT");
  return result.data;
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AccountError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

function nullableString(value: Prisma.JsonValue | undefined): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new AccountError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

function createResultFromJson(
  value: Prisma.JsonValue | null,
): CreateIdempotencyResult {
  const result = jsonObject(value);
  return { openingOperationId: nullableString(result.openingOperationId) };
}

function reconcileResultFromJson(
  value: Prisma.JsonValue | null,
): ReconcileIdempotencyResult {
  const result = jsonObject(value);
  if (
    typeof result.accountId !== "string" ||
    !(typeof result.operationId === "string" || result.operationId === null) ||
    typeof result.previousBalanceMinor !== "string" ||
    typeof result.actualBalanceMinor !== "string" ||
    typeof result.deltaMinor !== "string" ||
    typeof result.changed !== "boolean"
  ) {
    throw new AccountError("IDEMPOTENCY_CONFLICT");
  }
  return result as unknown as ReconcileIdempotencyResult;
}

async function financialState(
  database: AccountDatabase,
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

async function accountReadModel(
  database: AccountDatabase,
  userId: string,
  account: Account,
): Promise<AccountReadModel> {
  const state = await financialState(database, userId, account.id);
  const availableMinor = state.balanceMinor - state.reservedMinor;
  const spendingCapacityMinor =
    account.type === AccountType.CREDIT_CARD
      ? availableMinor + (account.creditLimitMinor ?? 0n)
      : availableMinor;
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    visualTheme: account.visualTheme,
    imageAssetId: account.imageAssetId,
    last4: account.last4,
    creditLimitMinor: account.creditLimitMinor,
    archivedAt: account.archivedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    balanceMinor: state.balanceMinor,
    reservedMinor: state.reservedMinor,
    availableMinor,
    spendingCapacityMinor,
  };
}

async function ownedAccount(
  database: AccountDatabase,
  userId: string,
  accountId: string,
): Promise<Account> {
  const account = await database.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new AccountError("ACCOUNT_NOT_FOUND");
  return account;
}

async function lockOwnedAccount(
  database: Prisma.TransactionClient,
  userId: string,
  accountId: string,
): Promise<Account> {
  const rows = await database.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "accounts"
    WHERE "id" = ${accountId}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw new AccountError("ACCOUNT_NOT_FOUND");
  return ownedAccount(database, userId, accountId);
}

function assertFinancialFloor(account: Account, state: FinancialState): void {
  if (account.type === AccountType.CREDIT_CARD) {
    if (state.balanceMinor < -(account.creditLimitMinor ?? 0n)) {
      throw new AccountError("CREDIT_LIMIT_EXCEEDED");
    }
    if (
      state.reservedMinor > (state.balanceMinor > 0n ? state.balanceMinor : 0n)
    ) {
      throw new AccountError("INSUFFICIENT_AVAILABLE_FUNDS");
    }
    return;
  }
  if (state.balanceMinor - state.reservedMinor < 0n) {
    throw new AccountError("INSUFFICIENT_AVAILABLE_FUNDS");
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

function createPayloadHash(input: ParsedCreateAccountInput): string {
  return requestHash(CREATE_SCOPE, [
    input.name,
    input.type,
    input.currency,
    input.visualTheme,
    input.imageAssetId ?? null,
    input.creditLimitMinor?.toString() ?? null,
    input.openingBalanceMinor.toString(),
  ]);
}

function reconcilePayloadHash(input: ParsedReconcileAccountInput): string {
  return requestHash(RECONCILE_SCOPE, [
    input.accountId,
    input.actualBalanceMinor.toString(),
  ]);
}

async function assertIdempotencyRecord(
  database: AccountDatabase,
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
    throw new AccountError("IDEMPOTENCY_CONFLICT");
  }
  if (existing.state !== IdempotencyState.COMPLETED) {
    throw new AccountError("IDEMPOTENCY_IN_PROGRESS");
  }
  return existing;
}

export function createAccountService(dependencies: AccountServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const generatedCardLast4 = () =>
    randomInt(0, 10_000).toString().padStart(4, "0");

  async function assertOwnedImage(
    database: AccountDatabase,
    userId: string,
    imageAssetId: string | null | undefined,
  ) {
    if (!imageAssetId) return;
    const image = await database.imageAsset.findFirst({
      where: { id: imageAssetId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!image) throw new AccountError("INVALID_INPUT");
  }

  async function getAccount(
    userId: string,
    accountIdInput: unknown,
  ): Promise<AccountReadModel> {
    const accountId = assertParsed(accountIdSchema.safeParse(accountIdInput));
    const account = await ownedAccount(
      dependencies.database,
      userId,
      accountId,
    );
    return accountReadModel(dependencies.database, userId, account);
  }

  async function replayCreate(
    database: AccountDatabase,
    userId: string,
    input: ParsedCreateAccountInput,
    hash: string,
  ): Promise<CreateAccountResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      CREATE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new AccountError("IDEMPOTENCY_CONFLICT");
    const stored = createResultFromJson(record.resultJson);
    const account = await ownedAccount(database, userId, record.resourceId);
    return {
      account: await accountReadModel(database, userId, account),
      openingOperationId: stored.openingOperationId,
      replayed: true,
    };
  }

  async function createAccount(
    userId: string,
    inputValue: CreateAccountInput,
  ): Promise<CreateAccountResult> {
    const input = assertParsed(createAccountInputSchema.safeParse(inputValue));
    const hash = createPayloadHash(input);
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

        const user = await database.user.findUnique({
          where: { id: userId },
          select: { baseCurrency: true },
        });
        if (!user) throw new AccountError("ACCOUNT_NOT_FOUND");
        if (user.baseCurrency !== input.currency) {
          throw new AccountError("CURRENCY_MISMATCH");
        }
        await assertOwnedImage(database, userId, input.imageAssetId);

        await database.idempotencyKey.create({
          data: {
            userId,
            scope: CREATE_SCOPE,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: now(),
          },
        });
        const account = await database.account.create({
          data: {
            userId,
            name: input.name,
            type: input.type,
            currency: input.currency,
            visualTheme: input.visualTheme,
            imageAssetId: input.imageAssetId ?? null,
            last4:
              input.type === AccountType.DEBIT_CARD ||
              input.type === AccountType.CREDIT_CARD
                ? generatedCardLast4()
                : null,
            ...(input.creditLimitMinor !== undefined
              ? { creditLimitMinor: input.creditLimitMinor }
              : {}),
          },
        });

        let openingOperationId: string | null = null;
        if (input.openingBalanceMinor !== 0n) {
          const operation = await database.financialOperation.create({
            data: {
              userId,
              type: OperationType.OPENING_BALANCE,
              occurredAt: now(),
            },
          });
          await database.ledgerEntry.create({
            data: {
              userId,
              operationId: operation.id,
              accountId: account.id,
              amountMinor: input.openingBalanceMinor,
              role: LedgerEntryRole.PRIMARY,
            },
          });
          openingOperationId = operation.id;
        }

        await database.idempotencyKey.update({
          where: {
            userId_scope_key: {
              userId,
              scope: CREATE_SCOPE,
              key: input.idempotencyKey,
            },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "account",
            resourceId: account.id,
            resultJson: { openingOperationId },
            completedAt: now(),
          },
        });
        return {
          account: await accountReadModel(database, userId, account),
          openingOperationId,
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

  async function replayReconciliation(
    database: AccountDatabase,
    userId: string,
    input: ParsedReconcileAccountInput,
    hash: string,
  ): Promise<ReconcileAccountResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      RECONCILE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record) throw new AccountError("IDEMPOTENCY_CONFLICT");
    const result = reconcileResultFromJson(record.resultJson);
    return {
      accountId: result.accountId,
      operationId: result.operationId,
      previousBalanceMinor: BigInt(result.previousBalanceMinor),
      actualBalanceMinor: BigInt(result.actualBalanceMinor),
      deltaMinor: BigInt(result.deltaMinor),
      changed: result.changed,
      replayed: true,
    };
  }

  async function reconcileAccount(
    userId: string,
    inputValue: ReconcileAccountInput,
  ): Promise<ReconcileAccountResult> {
    const input = assertParsed(
      reconcileAccountInputSchema.safeParse(inputValue),
    );
    const hash = reconcilePayloadHash(input);
    try {
      return await runSerializable(dependencies.database, async (database) => {
        const existing = await assertIdempotencyRecord(
          database,
          userId,
          RECONCILE_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (existing)
          return replayReconciliation(database, userId, input, hash);

        await database.idempotencyKey.create({
          data: {
            userId,
            scope: RECONCILE_SCOPE,
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
        if (account.archivedAt) throw new AccountError("ACCOUNT_ARCHIVED");
        const state = await financialState(database, userId, account.id);
        assertFinancialFloor(account, {
          balanceMinor: input.actualBalanceMinor,
          reservedMinor: state.reservedMinor,
        });

        const deltaMinor = input.actualBalanceMinor - state.balanceMinor;
        let operationId: string | null = null;
        if (deltaMinor !== 0n) {
          const operation = await database.financialOperation.create({
            data: {
              userId,
              type: OperationType.BALANCE_ADJUSTMENT,
              occurredAt: now(),
            },
          });
          await database.ledgerEntry.create({
            data: {
              userId,
              operationId: operation.id,
              accountId: account.id,
              amountMinor: deltaMinor,
              role: LedgerEntryRole.PRIMARY,
            },
          });
          operationId = operation.id;
        }

        const result: ReconcileIdempotencyResult = {
          accountId: account.id,
          operationId,
          previousBalanceMinor: state.balanceMinor.toString(),
          actualBalanceMinor: input.actualBalanceMinor.toString(),
          deltaMinor: deltaMinor.toString(),
          changed: deltaMinor !== 0n,
        };
        await database.idempotencyKey.update({
          where: {
            userId_scope_key: {
              userId,
              scope: RECONCILE_SCOPE,
              key: input.idempotencyKey,
            },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "account-reconciliation",
            resourceId: account.id,
            resultJson: {
              accountId: result.accountId,
              operationId: result.operationId,
              previousBalanceMinor: result.previousBalanceMinor,
              actualBalanceMinor: result.actualBalanceMinor,
              deltaMinor: result.deltaMinor,
              changed: result.changed,
            },
            completedAt: now(),
          },
        });
        return {
          accountId: account.id,
          operationId,
          previousBalanceMinor: state.balanceMinor,
          actualBalanceMinor: input.actualBalanceMinor,
          deltaMinor,
          changed: deltaMinor !== 0n,
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayReconciliation(dependencies.database, userId, input, hash);
      }
      throw error;
    }
  }

  async function updateAccount(
    userId: string,
    inputValue: UpdateAccountInput,
  ): Promise<AccountReadModel> {
    const input = assertParsed(updateAccountInputSchema.safeParse(inputValue));
    let replacedImageId: string | null = null;
    const result = await runSerializable(
      dependencies.database,
      async (database) => {
        const account = await lockOwnedAccount(
          database,
          userId,
          input.accountId,
        );
        if (
          input.last4 !== undefined &&
          input.last4 !== null &&
          account.type !== AccountType.DEBIT_CARD &&
          account.type !== AccountType.CREDIT_CARD
        ) {
          throw new AccountError("INVALID_INPUT");
        }
        await assertOwnedImage(database, userId, input.imageAssetId);
        if (
          account.imageAssetId &&
          input.imageAssetId !== undefined &&
          input.imageAssetId !== account.imageAssetId
        ) {
          replacedImageId = account.imageAssetId;
        }
        if (
          input.creditLimitMinor !== undefined &&
          account.type !== AccountType.CREDIT_CARD
        ) {
          throw new AccountError("INVALID_INPUT");
        }
        if (input.creditLimitMinor !== undefined) {
          const state = await financialState(database, userId, account.id);
          assertFinancialFloor(
            { ...account, creditLimitMinor: input.creditLimitMinor },
            state,
          );
        }
        const updated = await database.account.update({
          where: { id: account.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.visualTheme !== undefined
              ? { visualTheme: input.visualTheme }
              : {}),
            ...(input.imageAssetId !== undefined
              ? { imageAssetId: input.imageAssetId }
              : {}),
            ...(input.last4 !== undefined ? { last4: input.last4 } : {}),
            ...(input.creditLimitMinor !== undefined
              ? { creditLimitMinor: input.creditLimitMinor }
              : {}),
          },
        });
        return accountReadModel(database, userId, updated);
      },
    );
    if (replacedImageId) {
      await dependencies.reclaimImage?.(userId, replacedImageId);
    }
    return result;
  }

  async function archiveAccount(
    userId: string,
    accountIdInput: unknown,
  ): Promise<AccountReadModel> {
    const accountId = assertParsed(accountIdSchema.safeParse(accountIdInput));
    return runSerializable(dependencies.database, async (database) => {
      const account = await lockOwnedAccount(database, userId, accountId);
      if (account.archivedAt)
        return accountReadModel(database, userId, account);
      const state = await financialState(database, userId, account.id);
      if (state.reservedMinor !== 0n) {
        throw new AccountError("ACTIVE_RESERVATION");
      }
      const archived = await database.account.update({
        where: { id: account.id },
        data: { archivedAt: now() },
      });
      return accountReadModel(database, userId, archived);
    });
  }

  async function deleteAccount(
    userId: string,
    accountIdInput: unknown,
  ): Promise<void> {
    const accountId = assertParsed(accountIdSchema.safeParse(accountIdInput));
    await runSerializable(dependencies.database, async (database) => {
      const account = await lockOwnedAccount(database, userId, accountId);
      const [ledgerCount, reservationCount] = await Promise.all([
        database.ledgerEntry.count({
          where: { userId, accountId: account.id },
        }),
        database.goalReservationEntry.count({
          where: { userId, sourceAccountId: account.id },
        }),
      ]);
      if (ledgerCount > 0 || reservationCount > 0) {
        throw new AccountError("ACCOUNT_HAS_HISTORY");
      }
      await database.idempotencyKey.deleteMany({
        where: {
          userId,
          resourceId: account.id,
          resourceType: { in: ["account", "account-reconciliation"] },
        },
      });
      await database.account.delete({ where: { id: account.id } });
    });
  }

  async function getTotalCapital(userId: string): Promise<bigint> {
    const result = await dependencies.database.ledgerEntry.aggregate({
      where: { userId },
      _sum: { amountMinor: true },
    });
    return result._sum.amountMinor ?? 0n;
  }

  async function getMonthFlow(
    userId: string,
    accountIdInput: unknown,
    monthInput: unknown,
  ): Promise<{ inflowMinor: bigint; outflowMinor: bigint }> {
    const accountId = assertParsed(accountIdSchema.safeParse(accountIdInput));
    const month = assertParsed(accountMonthSchema.safeParse(monthInput));
    await ownedAccount(dependencies.database, userId, accountId);
    const settings = await dependencies.database.userSettings.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    if (!settings) throw new AccountError("ACCOUNT_NOT_FOUND");
    const monthStart = `${month}-01`;
    const rows = await dependencies.database.$queryRaw<
      Array<{ inflowMinor: bigint; outflowMinor: bigint }>
    >`
      SELECT
        COALESCE(SUM(CASE WHEN entry."amountMinor" > 0 THEN entry."amountMinor" ELSE 0 END), 0)::bigint AS "inflowMinor",
        COALESCE(SUM(CASE WHEN entry."amountMinor" < 0 THEN -entry."amountMinor" ELSE 0 END), 0)::bigint AS "outflowMinor"
      FROM "ledger_entries" AS entry
      INNER JOIN "financial_operations" AS operation
        ON operation."id" = entry."operationId"
        AND operation."userId" = entry."userId"
      WHERE entry."userId" = ${userId}::uuid
        AND entry."accountId" = ${accountId}::uuid
        AND operation."type" NOT IN ('OPENING_BALANCE', 'BALANCE_ADJUSTMENT')
        AND operation."occurredAt" >= (${monthStart}::date::timestamp AT TIME ZONE ${settings.timeZone})
        AND operation."occurredAt" < ((${monthStart}::date + INTERVAL '1 month')::timestamp AT TIME ZONE ${settings.timeZone})
    `;
    return {
      inflowMinor: BigInt(rows[0]?.inflowMinor ?? 0n),
      outflowMinor: BigInt(rows[0]?.outflowMinor ?? 0n),
    };
  }

  async function listAccounts(userId: string): Promise<AccountReadModel[]> {
    const accounts = await dependencies.database.account.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      accounts.map((account) =>
        accountReadModel(dependencies.database, userId, account),
      ),
    );
  }

  async function getAccountDetail(
    userId: string,
    accountIdInput: unknown,
  ): Promise<AccountDetailReadModel> {
    const accountId = assertParsed(accountIdSchema.safeParse(accountIdInput));
    const account = await ownedAccount(
      dependencies.database,
      userId,
      accountId,
    );
    const settings = await dependencies.database.userSettings.findUnique({
      where: { userId },
      select: { timeZone: true },
    });
    if (!settings) throw new AccountError("ACCOUNT_NOT_FOUND");

    const yearMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.timeZone,
      year: "numeric",
      month: "2-digit",
    }).format(now());
    const { inflowMinor, outflowMinor } = await getMonthFlow(
      userId,
      accountId,
      yearMonth,
    );
    const month = { yearMonth, inflowMinor, outflowMinor };

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: settings.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now());
    const windowStart = new Date(`${today}T00:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - 29);
    const startLocal = windowStart.toISOString().slice(0, 10);
    const windowEnd = new Date(`${today}T00:00:00Z`);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    const endLocal = windowEnd.toISOString().slice(0, 10);

    const seriesRows = await dependencies.database.$queryRaw<
      Array<{ day: string; balance: bigint }>
    >`
      WITH "daily" AS (
        SELECT date_trunc('day', "operation"."occurredAt" AT TIME ZONE ${settings.timeZone}) AS "day",
               SUM("entry"."amountMinor")::bigint AS "delta"
        FROM "ledger_entries" AS "entry"
        INNER JOIN "financial_operations" AS "operation"
          ON "operation"."id" = "entry"."operationId"
          AND "operation"."userId" = "entry"."userId"
        WHERE "entry"."userId" = ${userId}::uuid
          AND "entry"."accountId" = ${accountId}::uuid
          AND "operation"."occurredAt" < (${endLocal}::timestamp AT TIME ZONE ${settings.timeZone})
        GROUP BY 1
      ), "cumulative" AS (
        SELECT "day", SUM("delta") OVER (ORDER BY "day")::bigint AS "balance"
        FROM "daily"
      )
      SELECT to_char("day", 'YYYY-MM-DD') AS "day", "balance"
      FROM "cumulative"
      WHERE "day" >= ${startLocal}::timestamp
      ORDER BY "day"
    `;
    const balanceSeries: AccountBalancePoint[] = seriesRows.map((row) => ({
      day: row.day,
      balanceMinor: BigInt(row.balance ?? 0n),
    }));

    const transactionRows = await dependencies.database.$queryRaw<
      Array<{
        operationId: string;
        type: OperationType;
        note: string | null;
        categoryLabel: string | null;
        categoryIcon: string | null;
        occurredAt: Date;
        amountMinor: bigint;
        role: LedgerEntryRole;
      }>
    >`
      SELECT "operation"."id" AS "operationId",
             "operation"."type" AS "type",
             "operation"."note" AS "note",
             "operation"."occurredAt" AS "occurredAt",
             "category"."labelRu" AS "categoryLabel",
             "category"."iconName" AS "categoryIcon",
             "entry"."amountMinor"::bigint AS "amountMinor",
             "entry"."role" AS "role"
      FROM "ledger_entries" AS "entry"
      INNER JOIN "financial_operations" AS "operation"
        ON "operation"."id" = "entry"."operationId"
        AND "operation"."userId" = "entry"."userId"
      LEFT JOIN "categories" AS "category"
        ON "category"."id" = "operation"."categoryId"
      WHERE "entry"."userId" = ${userId}::uuid
        AND "entry"."accountId" = ${accountId}::uuid
      ORDER BY "operation"."occurredAt" DESC, "operation"."id" DESC
      LIMIT 20
    `;
    const recentTransactions: AccountDetailTransaction[] = transactionRows.map(
      (row) => ({
        operationId: row.operationId,
        type: row.type,
        note: row.note,
        categoryLabel: row.categoryLabel,
        categoryIcon: row.categoryIcon,
        occurredAt: new Date(row.occurredAt),
        amountMinor: BigInt(row.amountMinor),
        role: row.role,
      }),
    );

    return {
      account: await accountReadModel(dependencies.database, userId, account),
      timeZone: settings.timeZone,
      month,
      balanceSeries,
      recentTransactions,
    };
  }

  return {
    createAccount,
    getAccount,
    getMonthFlow,
    getTotalCapital,
    listAccounts,
    getAccountDetail,
    updateAccount,
    archiveAccount,
    deleteAccount,
    reconcileAccount,
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
export type { CreateAccountInput, ReconcileAccountInput, UpdateAccountInput };

import "server-only";

import { createHash } from "node:crypto";

import {
  AccountType,
  GoalReservationType,
  GoalStatus,
  IdempotencyState,
  LedgerEntryRole,
  OperationType,
  Prisma,
  type Account,
  type Goal,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  type CalendarDate,
  differenceInCalendarDays,
  parseTargetDate,
  todayInTimeZone,
} from "@/lib/dates";
import { GoalError } from "@/server/goals/errors";
import {
  goalCompletedEvent,
  type GoalDomainEvent,
  publishGoalDomainEvent,
} from "@/server/goals/domain-events";
import {
  completeGoalInputSchema,
  contributeGoalInputSchema,
  createGoalInputSchema,
  goalIdSchema,
  goalListViewSchema,
  updateGoalInputSchema,
  withdrawGoalInputSchema,
  type CompleteGoalInput,
  type ContributeGoalInput,
  type CreateGoalInput,
  type GoalListView,
  type ParsedCompleteGoalInput,
  type ParsedContributeGoalInput,
  type ParsedCreateGoalInput,
  type ParsedWithdrawGoalInput,
  type UpdateGoalInput,
  type WithdrawGoalInput,
} from "@/server/goals/validation";

type GoalDatabase = PrismaClient | Prisma.TransactionClient;
type GoalWithImage = Prisma.GoalGetPayload<{ include: { imageAsset: true } }>;

interface GoalServiceDependencies {
  database: PrismaClient;
  now?: () => Date;
  publishEvent?: (event: GoalDomainEvent) => void;
  /**
   * Best-effort освобождение изображения, вытесненного из цели при update
   * (мягкое удаление записи + удаление файла). Вызывается после commit.
   */
  reclaimImage?: (userId: string, imageAssetId: string) => Promise<void>;
}

export interface GoalImageReadModel {
  id: string;
  mimeType: string;
  byteSize: bigint;
  width: number;
  height: number;
  integrityHash: string | null;
  createdAt: Date;
}

export interface GoalReadModel {
  id: string;
  name: string;
  category: Goal["category"];
  description: string | null;
  targetAmountMinor: bigint;
  reservedAmountMinor: bigint;
  targetDate: CalendarDate | null;
  priority: Goal["priority"];
  status: Goal["status"];
  image: GoalImageReadModel | null;
  actualPurchaseAmountMinor: bigint | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGoalResult {
  goal: GoalReadModel;
  initialReservationEntryId: string | null;
  replayed: boolean;
}

export interface ReserveMutationResult {
  goal: GoalReadModel;
  entryId: string;
  replayed: boolean;
}

export interface CompleteGoalResult {
  goal: GoalReadModel;
  purchaseOperationId: string;
  replayed: boolean;
}

interface StoredCreateResult {
  goalId: string;
  initialReservationEntryId: string | null;
}

interface StoredReserveResult {
  entryId: string;
}

interface StoredCompleteResult {
  goalId: string;
  purchaseOperationId: string;
}

interface CompleteGoalTransactionResult extends CompleteGoalResult {
  releasedReserveAmountMinor: bigint;
}

const CREATE_SCOPE = "goal.create";
const CONTRIBUTE_SCOPE = "goal.contribute";
const WITHDRAW_SCOPE = "goal.withdraw";
const COMPLETE_SCOPE = "goal.complete";
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

function driverErrorCode(error: unknown): string | undefined {
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

function assertParsed<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) throw new GoalError("INVALID_INPUT");
  return result.data;
}

function requestHash(scope: string, values: readonly unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify([scope, ...values]))
    .digest("hex");
}

function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GoalError("IDEMPOTENCY_CONFLICT");
  }
  return value;
}

function storedCreateResult(
  value: Prisma.JsonValue | null,
): StoredCreateResult {
  const result = jsonObject(value);
  if (
    typeof result.goalId !== "string" ||
    !(
      result.initialReservationEntryId === null ||
      typeof result.initialReservationEntryId === "string"
    )
  ) {
    throw new GoalError("IDEMPOTENCY_CONFLICT");
  }
  return result as unknown as StoredCreateResult;
}

function storedReserveResult(
  value: Prisma.JsonValue | null,
): StoredReserveResult {
  const result = jsonObject(value);
  if (typeof result.entryId !== "string") {
    throw new GoalError("IDEMPOTENCY_CONFLICT");
  }
  return result as unknown as StoredReserveResult;
}

function storedCompleteResult(
  value: Prisma.JsonValue | null,
): StoredCompleteResult {
  const result = jsonObject(value);
  if (
    typeof result.goalId !== "string" ||
    typeof result.purchaseOperationId !== "string"
  ) {
    throw new GoalError("IDEMPOTENCY_CONFLICT");
  }
  return result as unknown as StoredCompleteResult;
}

function canonicalReserveHash(
  scope: string,
  input: ParsedContributeGoalInput | ParsedWithdrawGoalInput,
  occurredAt: Date,
): string {
  return requestHash(scope, [
    input.goalId.toLowerCase(),
    input.sourceAccountId.toLowerCase(),
    input.amountMinor.toString(),
    occurredAt.toISOString(),
    normalizedNullableText(input.note),
  ]);
}

function canonicalCompleteHash(
  input: ParsedCompleteGoalInput,
  occurredAt: Date,
): string {
  return requestHash(COMPLETE_SCOPE, [
    input.goalId.toLowerCase(),
    input.paymentAccountId.toLowerCase(),
    input.actualPurchaseAmountMinor.toString(),
    occurredAt.toISOString(),
    normalizedNullableText(input.note),
  ]);
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
  if (rows.length === 0) throw new GoalError("ACCOUNT_NOT_FOUND");
  const account = await database.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new GoalError("ACCOUNT_NOT_FOUND");
  return account;
}

function assertActiveAccount(account: Account): void {
  if (account.archivedAt) throw new GoalError("ACCOUNT_ARCHIVED");
}

function assertActiveGoal(goal: GoalWithImage): void {
  if (goal.status !== GoalStatus.ACTIVE) throw new GoalError("GOAL_NOT_ACTIVE");
}

async function accountFinancialState(
  database: GoalDatabase,
  userId: string,
  accountId: string,
): Promise<{ balanceMinor: bigint; reservedMinor: bigint }> {
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

function assertReservationFits(
  account: Account,
  balanceMinor: bigint,
  reservedAfterMinor: bigint,
): void {
  if (account.type === AccountType.CREDIT_CARD) {
    if (reservedAfterMinor > (balanceMinor > 0n ? balanceMinor : 0n)) {
      throw new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE");
    }
    return;
  }
  if (balanceMinor - reservedAfterMinor < 0n) {
    throw new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE");
  }
}

function assertPurchaseFits(
  account: Account,
  balanceAfterMinor: bigint,
  reservedAfterMinor: bigint,
): void {
  if (account.type === AccountType.CREDIT_CARD) {
    if (balanceAfterMinor < -(account.creditLimitMinor ?? 0n)) {
      throw new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE");
    }
    if (
      reservedAfterMinor > (balanceAfterMinor > 0n ? balanceAfterMinor : 0n)
    ) {
      throw new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE");
    }
    return;
  }
  if (balanceAfterMinor - reservedAfterMinor < 0n) {
    throw new GoalError("INSUFFICIENT_ACCOUNT_AVAILABLE");
  }
}

async function goalReservedOnAccount(
  database: GoalDatabase,
  userId: string,
  goalId: string,
  accountId: string,
): Promise<bigint> {
  const result = await database.goalReservationEntry.aggregate({
    where: { userId, goalId, sourceAccountId: accountId },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0n;
}

async function createReservationEntry(
  database: Prisma.TransactionClient,
  userId: string,
  goalId: string,
  sourceAccountId: string,
  type: GoalReservationType,
  amountMinor: bigint,
  occurredAt: Date,
  note: string | null,
): Promise<{ id: string }> {
  return database.goalReservationEntry.create({
    data: {
      userId,
      goalId,
      sourceAccountId,
      type,
      amountMinor,
      occurredAt,
      note,
    },
    select: { id: true },
  });
}

function normalizedNullableText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

function createPayloadHash(input: ParsedCreateGoalInput): string {
  return requestHash(CREATE_SCOPE, [
    input.name,
    input.category,
    normalizedNullableText(input.description),
    input.targetAmountMinor.toString(),
    input.targetDate ?? null,
    input.priority,
    input.imageAssetId?.toLowerCase() ?? null,
    input.initialReservation
      ? {
          sourceAccountId:
            input.initialReservation.sourceAccountId.toLowerCase(),
          amountMinor: input.initialReservation.amountMinor.toString(),
          occurredAt: new Date(
            input.initialReservation.occurredAt,
          ).toISOString(),
          note: normalizedNullableText(input.initialReservation.note),
        }
      : null,
  ]);
}

function targetDateForDatabase(value: CalendarDate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function targetDateFromDatabase(value: Date | null): CalendarDate | null {
  return value ? parseTargetDate(value.toISOString().slice(0, 10)) : null;
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
      const sqlState = driverErrorCode(error);
      if (
        (errorCode(error) !== "P2034" &&
          sqlState !== "40001" &&
          sqlState !== "40P01") ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw new Error("Unreachable transaction retry state.");
}

async function assertIdempotencyRecord(
  database: GoalDatabase,
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
    throw new GoalError("IDEMPOTENCY_CONFLICT");
  }
  if (existing.state !== IdempotencyState.COMPLETED) {
    throw new GoalError("IDEMPOTENCY_IN_PROGRESS");
  }
  return existing;
}

async function lockOwnedGoal(
  database: GoalDatabase,
  userId: string,
  goalId: string,
): Promise<GoalWithImage> {
  const rows = await database.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "goals"
    WHERE "id" = ${goalId}::uuid AND "userId" = ${userId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) throw new GoalError("GOAL_NOT_FOUND");
  const goal = await database.goal.findFirst({
    where: { id: goalId, userId },
    include: { imageAsset: true },
  });
  if (!goal) throw new GoalError("GOAL_NOT_FOUND");
  return goal;
}

async function ownedGoal(
  database: GoalDatabase,
  userId: string,
  goalId: string,
): Promise<GoalWithImage> {
  const goal = await database.goal.findFirst({
    where: { id: goalId, userId },
    include: { imageAsset: true },
  });
  if (!goal) throw new GoalError("GOAL_NOT_FOUND");
  return goal;
}

async function reservedAmount(
  database: GoalDatabase,
  userId: string,
  goalId: string,
): Promise<bigint> {
  const result = await database.goalReservationEntry.aggregate({
    where: { userId, goalId },
    _sum: { amountMinor: true },
  });
  return result._sum.amountMinor ?? 0n;
}

function imageReadModel(goal: GoalWithImage): GoalImageReadModel | null {
  if (!goal.imageAsset) return null;
  return {
    id: goal.imageAsset.id,
    mimeType: goal.imageAsset.mimeType,
    byteSize: goal.imageAsset.byteSize,
    width: goal.imageAsset.width,
    height: goal.imageAsset.height,
    integrityHash: goal.imageAsset.integrityHash,
    createdAt: goal.imageAsset.createdAt,
  };
}

function toReadModel(
  goal: GoalWithImage,
  reservedAmountMinor: bigint,
): GoalReadModel {
  return {
    id: goal.id,
    name: goal.name,
    category: goal.category,
    description: goal.description,
    targetAmountMinor: goal.targetAmountMinor,
    reservedAmountMinor,
    targetDate: targetDateFromDatabase(goal.targetDate),
    priority: goal.priority,
    status: goal.status,
    image: imageReadModel(goal),
    actualPurchaseAmountMinor: goal.actualPurchaseAmountMinor,
    completedAt: goal.completedAt,
    archivedAt: goal.archivedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

async function goalReadModel(
  database: GoalDatabase,
  userId: string,
  goal: GoalWithImage,
): Promise<GoalReadModel> {
  return toReadModel(goal, await reservedAmount(database, userId, goal.id));
}

async function resolveImage(
  database: GoalDatabase,
  userId: string,
  imageAssetId: string,
  currentGoalId?: string,
): Promise<void> {
  const image = await database.imageAsset.findFirst({
    where: { id: imageAssetId, userId, deletedAt: null },
    include: { goal: { select: { id: true } } },
  });
  if (!image) throw new GoalError("IMAGE_NOT_FOUND");
  if (image.goal && image.goal.id !== currentGoalId) {
    throw new GoalError("IMAGE_ALREADY_USED");
  }
}

async function userCalendarToday(
  database: GoalDatabase,
  userId: string,
  reference: Date,
): Promise<CalendarDate> {
  const settings = await database.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  if (!settings) throw new GoalError("INVALID_INPUT");
  return todayInTimeZone(settings.timeZone, reference);
}

async function assertTargetDateNotPast(
  database: GoalDatabase,
  userId: string,
  value: string | null | undefined,
  reference: Date,
): Promise<void> {
  if (!value) return;
  const targetDate = parseTargetDate(value);
  const today = await userCalendarToday(database, userId, reference);
  if (differenceInCalendarDays(today, targetDate) < 0) {
    throw new GoalError("TARGET_DATE_IN_PAST");
  }
}

export function createGoalService(dependencies: GoalServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const publishEvent = dependencies.publishEvent ?? publishGoalDomainEvent;

  async function getGoal(
    userId: string,
    goalIdInput: unknown,
  ): Promise<GoalReadModel> {
    const goalId = assertParsed(goalIdSchema.safeParse(goalIdInput));
    const goal = await ownedGoal(dependencies.database, userId, goalId);
    return goalReadModel(dependencies.database, userId, goal);
  }

  async function listGoals(
    userId: string,
    viewInput: unknown,
  ): Promise<GoalReadModel[]> {
    const view = assertParsed(goalListViewSchema.safeParse(viewInput));
    const goals = await dependencies.database.goal.findMany({
      where: {
        userId,
        status:
          view === "ACTIVE" ? GoalStatus.ACTIVE : { not: GoalStatus.ACTIVE },
      },
      include: { imageAsset: true },
      orderBy: [
        { priority: "asc" },
        { targetDate: "asc" },
        { createdAt: "asc" },
      ],
    });
    if (goals.length === 0) return [];
    const reservations =
      await dependencies.database.goalReservationEntry.groupBy({
        by: ["goalId"],
        where: { userId, goalId: { in: goals.map((goal) => goal.id) } },
        _sum: { amountMinor: true },
      });
    const reservedByGoal = new Map(
      reservations.map((entry) => [entry.goalId, entry._sum.amountMinor ?? 0n]),
    );
    return goals.map((goal) =>
      toReadModel(goal, reservedByGoal.get(goal.id) ?? 0n),
    );
  }

  async function replayCreate(
    database: GoalDatabase,
    userId: string,
    input: ParsedCreateGoalInput,
    hash: string,
  ): Promise<CreateGoalResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      CREATE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new GoalError("IDEMPOTENCY_CONFLICT");
    const stored = storedCreateResult(record.resultJson);
    if (stored.goalId !== record.resourceId) {
      throw new GoalError("IDEMPOTENCY_CONFLICT");
    }
    const goal = await ownedGoal(database, userId, stored.goalId);
    return {
      goal: await goalReadModel(database, userId, goal),
      initialReservationEntryId: stored.initialReservationEntryId,
      replayed: true,
    };
  }

  async function createGoal(
    userId: string,
    inputValue: CreateGoalInput,
  ): Promise<CreateGoalResult> {
    const input = assertParsed(createGoalInputSchema.safeParse(inputValue));
    const hash = createPayloadHash(input);
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

        const reference = now();
        await assertTargetDateNotPast(
          database,
          userId,
          input.targetDate,
          reference,
        );
        if (input.imageAssetId) {
          await resolveImage(database, userId, input.imageAssetId);
        }
        await database.idempotencyKey.create({
          data: {
            userId,
            scope: CREATE_SCOPE,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: reference,
          },
        });
        const goal = await database.goal.create({
          data: {
            userId,
            name: input.name,
            category: input.category,
            description: normalizedNullableText(input.description),
            targetAmountMinor: input.targetAmountMinor,
            ...(input.targetDate
              ? {
                  targetDate: targetDateForDatabase(
                    parseTargetDate(input.targetDate),
                  ),
                }
              : {}),
            priority: input.priority,
            ...(input.imageAssetId ? { imageAssetId: input.imageAssetId } : {}),
          },
          include: { imageAsset: true },
        });

        let initialReservationEntryId: string | null = null;
        if (input.initialReservation) {
          const account = await lockOwnedAccount(
            database,
            userId,
            input.initialReservation.sourceAccountId,
          );
          assertActiveAccount(account);
          const state = await accountFinancialState(
            database,
            userId,
            account.id,
          );
          assertReservationFits(
            account,
            state.balanceMinor,
            state.reservedMinor + input.initialReservation.amountMinor,
          );
          const reserved = await createReservationEntry(
            database,
            userId,
            goal.id,
            account.id,
            GoalReservationType.INITIAL_RESERVE,
            input.initialReservation.amountMinor,
            new Date(input.initialReservation.occurredAt),
            normalizedNullableText(input.initialReservation.note),
          );
          initialReservationEntryId = reserved.id;
        }

        const stored: StoredCreateResult = {
          goalId: goal.id,
          initialReservationEntryId,
        };
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
            resourceType: "goal",
            resourceId: goal.id,
            resultJson: {
              goalId: stored.goalId,
              initialReservationEntryId: stored.initialReservationEntryId,
            },
            completedAt: reference,
          },
        });
        return {
          goal: await goalReadModel(database, userId, goal),
          initialReservationEntryId,
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        const record = await assertIdempotencyRecord(
          dependencies.database,
          userId,
          CREATE_SCOPE,
          input.idempotencyKey,
          hash,
        );
        if (record) {
          return replayCreate(dependencies.database, userId, input, hash);
        }
        if (input.imageAssetId) throw new GoalError("IMAGE_ALREADY_USED");
      }
      throw error;
    }
  }

  async function replayReserveMutation(
    database: GoalDatabase,
    userId: string,
    scope: string,
    input: ParsedContributeGoalInput | ParsedWithdrawGoalInput,
    hash: string,
  ): Promise<ReserveMutationResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      scope,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new GoalError("IDEMPOTENCY_CONFLICT");
    const stored = storedReserveResult(record.resultJson);
    if (stored.entryId !== record.resourceId) {
      throw new GoalError("IDEMPOTENCY_CONFLICT");
    }
    const entry = await database.goalReservationEntry.findFirst({
      where: { id: stored.entryId, userId, goalId: input.goalId },
    });
    if (!entry) throw new GoalError("IDEMPOTENCY_CONFLICT");
    const goal = await ownedGoal(database, userId, input.goalId);
    return {
      goal: await goalReadModel(database, userId, goal),
      entryId: entry.id,
      replayed: true,
    };
  }

  async function reserveMutation(
    userId: string,
    scope: string,
    entryType: GoalReservationType,
    inputValue: ContributeGoalInput | WithdrawGoalInput,
  ): Promise<ReserveMutationResult> {
    const schema =
      scope === CONTRIBUTE_SCOPE
        ? contributeGoalInputSchema
        : withdrawGoalInputSchema;
    const input = assertParsed(schema.safeParse(inputValue)) as
      ParsedContributeGoalInput | ParsedWithdrawGoalInput;
    const occurredAt = new Date(input.occurredAt);
    const hash = canonicalReserveHash(scope, input, occurredAt);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      scope,
      input.idempotencyKey,
      hash,
    );
    if (completed) {
      return replayReserveMutation(
        dependencies.database,
        userId,
        scope,
        input,
        hash,
      );
    }
    const signedAmountMinor =
      scope === CONTRIBUTE_SCOPE ? input.amountMinor : -input.amountMinor;

    try {
      return await runSerializable(dependencies.database, async (database) => {
        const existing = await assertIdempotencyRecord(
          database,
          userId,
          scope,
          input.idempotencyKey,
          hash,
        );
        if (existing) {
          return replayReserveMutation(database, userId, scope, input, hash);
        }
        await database.idempotencyKey.create({
          data: {
            userId,
            scope,
            key: input.idempotencyKey,
            requestHash: hash,
            createdAt: now(),
          },
        });

        const goal = await lockOwnedGoal(database, userId, input.goalId);
        assertActiveGoal(goal);
        const account = await lockOwnedAccount(
          database,
          userId,
          input.sourceAccountId,
        );
        assertActiveAccount(account);

        if (scope === WITHDRAW_SCOPE) {
          const onAccount = await goalReservedOnAccount(
            database,
            userId,
            goal.id,
            account.id,
          );
          if (onAccount < input.amountMinor) {
            throw new GoalError("INSUFFICIENT_GOAL_RESERVE");
          }
        } else {
          const state = await accountFinancialState(
            database,
            userId,
            account.id,
          );
          assertReservationFits(
            account,
            state.balanceMinor,
            state.reservedMinor + input.amountMinor,
          );
        }

        const entry = await createReservationEntry(
          database,
          userId,
          goal.id,
          account.id,
          entryType,
          signedAmountMinor,
          occurredAt,
          normalizedNullableText(input.note),
        );
        await database.idempotencyKey.update({
          where: {
            userId_scope_key: { userId, scope, key: input.idempotencyKey },
          },
          data: {
            state: IdempotencyState.COMPLETED,
            resourceType: "goal-reservation",
            resourceId: entry.id,
            resultJson: { entryId: entry.id },
            completedAt: now(),
          },
        });
        return {
          goal: await goalReadModel(database, userId, goal),
          entryId: entry.id,
          replayed: false,
        };
      });
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayReserveMutation(
          dependencies.database,
          userId,
          scope,
          input,
          hash,
        );
      }
      throw error;
    }
  }

  async function contributeGoal(
    userId: string,
    inputValue: ContributeGoalInput,
  ): Promise<ReserveMutationResult> {
    return reserveMutation(
      userId,
      CONTRIBUTE_SCOPE,
      GoalReservationType.CONTRIBUTION,
      inputValue,
    );
  }

  async function withdrawGoal(
    userId: string,
    inputValue: WithdrawGoalInput,
  ): Promise<ReserveMutationResult> {
    return reserveMutation(
      userId,
      WITHDRAW_SCOPE,
      GoalReservationType.WITHDRAWAL,
      inputValue,
    );
  }

  async function replayComplete(
    database: GoalDatabase,
    userId: string,
    input: ParsedCompleteGoalInput,
    hash: string,
  ): Promise<CompleteGoalTransactionResult> {
    const record = await assertIdempotencyRecord(
      database,
      userId,
      COMPLETE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (!record?.resourceId) throw new GoalError("IDEMPOTENCY_CONFLICT");
    const stored = storedCompleteResult(record.resultJson);
    if (stored.goalId !== record.resourceId) {
      throw new GoalError("IDEMPOTENCY_CONFLICT");
    }
    const operation = await database.financialOperation.findFirst({
      where: { id: stored.purchaseOperationId, userId },
    });
    if (!operation) throw new GoalError("IDEMPOTENCY_CONFLICT");
    const goal = await ownedGoal(database, userId, stored.goalId);
    return {
      goal: await goalReadModel(database, userId, goal),
      purchaseOperationId: operation.id,
      replayed: true,
      releasedReserveAmountMinor: 0n,
    };
  }

  async function completeGoal(
    userId: string,
    inputValue: CompleteGoalInput,
  ): Promise<CompleteGoalResult> {
    const input = assertParsed(
      completeGoalInputSchema.safeParse(inputValue),
    ) as ParsedCompleteGoalInput;
    const occurredAt = new Date(input.occurredAt);
    const hash = canonicalCompleteHash(input, occurredAt);
    const completed = await assertIdempotencyRecord(
      dependencies.database,
      userId,
      COMPLETE_SCOPE,
      input.idempotencyKey,
      hash,
    );
    if (completed) {
      return replayComplete(dependencies.database, userId, input, hash);
    }

    try {
      const result = await runSerializable(
        dependencies.database,
        async (database) => {
          const existing = await assertIdempotencyRecord(
            database,
            userId,
            COMPLETE_SCOPE,
            input.idempotencyKey,
            hash,
          );
          if (existing) {
            return replayComplete(database, userId, input, hash);
          }
          await database.idempotencyKey.create({
            data: {
              userId,
              scope: COMPLETE_SCOPE,
              key: input.idempotencyKey,
              requestHash: hash,
              createdAt: now(),
            },
          });

          const goal = await lockOwnedGoal(database, userId, input.goalId);
          assertActiveGoal(goal);
          const account = await lockOwnedAccount(
            database,
            userId,
            input.paymentAccountId,
          );
          assertActiveAccount(account);

          const reservedByAccount = await database.goalReservationEntry.groupBy(
            {
              by: ["sourceAccountId"],
              where: { userId, goalId: goal.id },
              _sum: { amountMinor: true },
            },
          );
          const goalOnPaymentAccount =
            reservedByAccount.find((row) => row.sourceAccountId === account.id)
              ?._sum.amountMinor ?? 0n;
          const state = await accountFinancialState(
            database,
            userId,
            account.id,
          );
          assertPurchaseFits(
            account,
            state.balanceMinor - input.actualPurchaseAmountMinor,
            state.reservedMinor - goalOnPaymentAccount,
          );

          let releasedReserveAmountMinor = 0n;
          for (const row of reservedByAccount) {
            const amount = row._sum.amountMinor ?? 0n;
            if (amount === 0n) continue;
            await createReservationEntry(
              database,
              userId,
              goal.id,
              row.sourceAccountId,
              GoalReservationType.RELEASE_ON_COMPLETION,
              -amount,
              now(),
              null,
            );
            releasedReserveAmountMinor += amount;
          }

          const operation = await database.financialOperation.create({
            data: {
              userId,
              type: OperationType.GOAL_PURCHASE,
              goalId: goal.id,
              note: normalizedNullableText(input.note),
              occurredAt,
            },
          });
          await database.ledgerEntry.create({
            data: {
              userId,
              operationId: operation.id,
              accountId: account.id,
              amountMinor: -input.actualPurchaseAmountMinor,
              role: LedgerEntryRole.PRIMARY,
            },
          });

          const completedGoal = await database.goal.update({
            where: { id: goal.id },
            data: {
              status: GoalStatus.COMPLETED,
              completedAt: now(),
              actualPurchaseAmountMinor: input.actualPurchaseAmountMinor,
              archivedAt: now(),
            },
            include: { imageAsset: true },
          });

          await database.idempotencyKey.update({
            where: {
              userId_scope_key: {
                userId,
                scope: COMPLETE_SCOPE,
                key: input.idempotencyKey,
              },
            },
            data: {
              state: IdempotencyState.COMPLETED,
              resourceType: "goal",
              resourceId: goal.id,
              resultJson: {
                goalId: goal.id,
                purchaseOperationId: operation.id,
              },
              completedAt: now(),
            },
          });
          return {
            goal: await goalReadModel(database, userId, completedGoal),
            purchaseOperationId: operation.id,
            releasedReserveAmountMinor,
            replayed: false,
          };
        },
      );
      if (!result.replayed) {
        publishEvent(
          goalCompletedEvent(
            {
              goalId: result.goal.id,
              userId,
              name: result.goal.name,
              category: result.goal.category,
              targetAmountMinor: result.goal.targetAmountMinor,
              actualPurchaseAmountMinor: input.actualPurchaseAmountMinor,
              releasedReserveAmountMinor: result.releasedReserveAmountMinor,
              purchaseOperationId: result.purchaseOperationId,
            },
            now(),
          ),
        );
      }
      return {
        goal: result.goal,
        purchaseOperationId: result.purchaseOperationId,
        replayed: false,
      };
    } catch (error) {
      if (errorCode(error) === "P2002") {
        return replayComplete(dependencies.database, userId, input, hash);
      }
      throw error;
    }
  }

  async function updateGoal(
    userId: string,
    inputValue: UpdateGoalInput,
  ): Promise<GoalReadModel> {
    const input = assertParsed(updateGoalInputSchema.safeParse(inputValue));
    let replacedImageId: string | null = null;
    try {
      const result = await runSerializable(
        dependencies.database,
        async (database) => {
          const goal = await lockOwnedGoal(database, userId, input.goalId);
          if (goal.status !== GoalStatus.ACTIVE) {
            throw new GoalError("GOAL_NOT_EDITABLE");
          }
          if (input.targetDate !== undefined) {
            await assertTargetDateNotPast(
              database,
              userId,
              input.targetDate,
              now(),
            );
          }
          if (input.imageAssetId) {
            await resolveImage(database, userId, input.imageAssetId, goal.id);
          }
          if (
            goal.imageAssetId &&
            input.imageAssetId !== undefined &&
            input.imageAssetId !== goal.imageAssetId
          ) {
            replacedImageId = goal.imageAssetId;
          }
          const updated = await database.goal.update({
            where: { id: goal.id },
            data: {
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.category !== undefined
                ? { category: input.category }
                : {}),
              ...(input.description !== undefined
                ? { description: normalizedNullableText(input.description) }
                : {}),
              ...(input.targetAmountMinor !== undefined
                ? { targetAmountMinor: input.targetAmountMinor }
                : {}),
              ...(input.targetDate !== undefined
                ? {
                    targetDate: input.targetDate
                      ? targetDateForDatabase(parseTargetDate(input.targetDate))
                      : null,
                  }
                : {}),
              ...(input.priority !== undefined
                ? { priority: input.priority }
                : {}),
              ...(input.imageAssetId !== undefined
                ? { imageAssetId: input.imageAssetId }
                : {}),
            },
            include: { imageAsset: true },
          });
          return goalReadModel(database, userId, updated);
        },
      );
      if (replacedImageId) {
        try {
          await dependencies.reclaimImage?.(userId, replacedImageId);
        } catch {
          // Best effort: цель уже обновлена; orphan sweep покроет остатки.
        }
      }
      return result;
    } catch (error) {
      if (errorCode(error) === "P2002" && input.imageAssetId) {
        throw new GoalError("IMAGE_ALREADY_USED");
      }
      throw error;
    }
  }

  async function archiveGoal(
    userId: string,
    goalIdInput: unknown,
  ): Promise<GoalReadModel> {
    const goalId = assertParsed(goalIdSchema.safeParse(goalIdInput));
    return runSerializable(dependencies.database, async (database) => {
      const goal = await lockOwnedGoal(database, userId, goalId);
      if (goal.status !== GoalStatus.ACTIVE) {
        return goalReadModel(database, userId, goal);
      }
      if ((await reservedAmount(database, userId, goal.id)) !== 0n) {
        throw new GoalError("ACTIVE_RESERVATION");
      }
      const archived = await database.goal.update({
        where: { id: goal.id },
        data: { status: GoalStatus.ARCHIVED, archivedAt: now() },
        include: { imageAsset: true },
      });
      return goalReadModel(database, userId, archived);
    });
  }

  async function restoreGoal(
    userId: string,
    goalIdInput: unknown,
  ): Promise<GoalReadModel> {
    const goalId = assertParsed(goalIdSchema.safeParse(goalIdInput));
    return runSerializable(dependencies.database, async (database) => {
      const goal = await lockOwnedGoal(database, userId, goalId);
      if (goal.status === GoalStatus.ACTIVE) {
        return goalReadModel(database, userId, goal);
      }
      if (
        goal.status !== GoalStatus.ARCHIVED ||
        goal.completedAt !== null ||
        goal.actualPurchaseAmountMinor !== null ||
        (await reservedAmount(database, userId, goal.id)) !== 0n
      ) {
        throw new GoalError("GOAL_NOT_RESTORABLE");
      }
      const restored = await database.goal.update({
        where: { id: goal.id },
        data: { status: GoalStatus.ACTIVE, archivedAt: null },
        include: { imageAsset: true },
      });
      return goalReadModel(database, userId, restored);
    });
  }

  return {
    createGoal,
    getGoal,
    listGoals,
    updateGoal,
    archiveGoal,
    restoreGoal,
    contributeGoal,
    withdrawGoal,
    completeGoal,
  };
}

export type GoalService = ReturnType<typeof createGoalService>;
export type {
  CompleteGoalInput,
  ContributeGoalInput,
  CreateGoalInput,
  GoalListView,
  UpdateGoalInput,
  WithdrawGoalInput,
};

import type {
  AccountType,
  Currency,
  LedgerEntryRole,
  OperationType,
} from "@/generated/prisma/client";
import { serializeMoney, type SerializedMoney } from "@/lib/money";
import type {
  AccountBalancePoint,
  AccountDetailReadModel,
  AccountDetailTransaction,
  AccountReadModel,
  ReconcileAccountResult,
} from "@/server/accounts/service";

export interface ClientAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  visualTheme: string;
  imageAssetId?: string | null;
  last4: string | null;
  creditLimitMinor: SerializedMoney | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  balanceMinor: SerializedMoney;
  reservedMinor: SerializedMoney;
  availableMinor: SerializedMoney;
  spendingCapacityMinor: SerializedMoney;
}

export interface ClientDetailTransaction {
  operationId: string;
  type: OperationType;
  role: LedgerEntryRole;
  note: string | null;
  categoryLabel: string | null;
  categoryIcon: string | null;
  occurredAt: string;
  amountMinor: SerializedMoney;
}

export interface ClientBalancePoint {
  day: string;
  balanceMinor: SerializedMoney;
}

export interface ClientAccountDetail {
  account: ClientAccount;
  timeZone: string;
  month: {
    yearMonth: string;
    inflowMinor: SerializedMoney;
    outflowMinor: SerializedMoney;
  };
  balanceSeries: ClientBalancePoint[];
  recentTransactions: ClientDetailTransaction[];
}

export interface ClientReconcileResult {
  accountId: string;
  previousBalanceMinor: SerializedMoney;
  actualBalanceMinor: SerializedMoney;
  deltaMinor: SerializedMoney;
  changed: boolean;
}

export function toClientAccount(account: AccountReadModel): ClientAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    visualTheme: account.visualTheme,
    imageAssetId: account.imageAssetId,
    last4: account.last4,
    creditLimitMinor:
      account.creditLimitMinor === null
        ? null
        : serializeMoney(account.creditLimitMinor),
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    balanceMinor: serializeMoney(account.balanceMinor),
    reservedMinor: serializeMoney(account.reservedMinor),
    availableMinor: serializeMoney(account.availableMinor),
    spendingCapacityMinor: serializeMoney(account.spendingCapacityMinor),
  };
}

function toClientTransaction(
  transaction: AccountDetailTransaction,
): ClientDetailTransaction {
  return {
    operationId: transaction.operationId,
    type: transaction.type,
    role: transaction.role,
    note: transaction.note,
    categoryLabel: transaction.categoryLabel,
    categoryIcon: transaction.categoryIcon,
    occurredAt: transaction.occurredAt.toISOString(),
    amountMinor: serializeMoney(transaction.amountMinor),
  };
}

function toClientBalancePoint(point: AccountBalancePoint): ClientBalancePoint {
  return { day: point.day, balanceMinor: serializeMoney(point.balanceMinor) };
}

export function toClientAccountDetail(
  detail: AccountDetailReadModel,
): ClientAccountDetail {
  return {
    account: toClientAccount(detail.account),
    timeZone: detail.timeZone,
    month: {
      yearMonth: detail.month.yearMonth,
      inflowMinor: serializeMoney(detail.month.inflowMinor),
      outflowMinor: serializeMoney(detail.month.outflowMinor),
    },
    balanceSeries: detail.balanceSeries.map(toClientBalancePoint),
    recentTransactions: detail.recentTransactions.map(toClientTransaction),
  };
}

export function toClientReconcileResult(
  result: ReconcileAccountResult,
): ClientReconcileResult {
  return {
    accountId: result.accountId,
    previousBalanceMinor: serializeMoney(result.previousBalanceMinor),
    actualBalanceMinor: serializeMoney(result.actualBalanceMinor),
    deltaMinor: serializeMoney(result.deltaMinor),
    changed: result.changed,
  };
}

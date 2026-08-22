import "server-only";

export type AccountErrorCode =
  | "INVALID_INPUT"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_ARCHIVED"
  | "ACCOUNT_HAS_HISTORY"
  | "ACTIVE_RESERVATION"
  | "CURRENCY_MISMATCH"
  | "INSUFFICIENT_AVAILABLE_FUNDS"
  | "CREDIT_LIMIT_EXCEEDED"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS";

const PUBLIC_MESSAGES: Record<AccountErrorCode, string> = {
  INVALID_INPUT: "Проверьте данные счёта.",
  ACCOUNT_NOT_FOUND: "Счёт не найден.",
  ACCOUNT_ARCHIVED: "Архивный счёт нельзя изменять финансовой операцией.",
  ACCOUNT_HAS_HISTORY: "Счёт с историей нельзя удалить. Используйте архив.",
  ACTIVE_RESERVATION: "Сначала освободите средства, зарезервированные на цели.",
  CURRENCY_MISMATCH: "Валюта счёта должна совпадать с базовой валютой.",
  INSUFFICIENT_AVAILABLE_FUNDS:
    "Недостаточно доступных средств на выбранном счёте.",
  CREDIT_LIMIT_EXCEEDED: "Сумма долга превышает установленный кредитный лимит.",
  IDEMPOTENCY_CONFLICT:
    "Этот идентификатор операции уже использован с другими данными.",
  IDEMPOTENCY_IN_PROGRESS: "Операция уже выполняется. Повторите запрос позже.",
};

export class AccountError extends Error {
  override readonly name = "AccountError";
  readonly code: AccountErrorCode;

  constructor(code: AccountErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.code = code;
  }
}

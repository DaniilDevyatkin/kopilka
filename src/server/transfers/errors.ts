import "server-only";

export type TransferErrorCode =
  | "INVALID_INPUT"
  | "TRANSFER_NOT_FOUND"
  | "TRANSFER_NOT_ACTIVE"
  | "TRANSFER_INTEGRITY_ERROR"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_ARCHIVED"
  | "SAME_ACCOUNT"
  | "CURRENCY_MISMATCH"
  | "INSUFFICIENT_AVAILABLE_FUNDS"
  | "CREDIT_LIMIT_EXCEEDED"
  | "DATE_OUT_OF_RANGE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS";

const PUBLIC_MESSAGES: Record<TransferErrorCode, string> = {
  INVALID_INPUT: "Проверьте данные перевода.",
  TRANSFER_NOT_FOUND: "Перевод не найден.",
  TRANSFER_NOT_ACTIVE: "Этот перевод уже изменён или отменён.",
  TRANSFER_INTEGRITY_ERROR: "Не удалось проверить целостность перевода.",
  ACCOUNT_NOT_FOUND: "Счёт не найден.",
  ACCOUNT_ARCHIVED: "Архивный счёт нельзя использовать для нового перевода.",
  SAME_ACCOUNT: "Выберите разные счета для перевода.",
  CURRENCY_MISMATCH: "Перевод между разными валютами пока недоступен.",
  INSUFFICIENT_AVAILABLE_FUNDS:
    "Недостаточно свободных средств на выбранном счёте.",
  CREDIT_LIMIT_EXCEEDED: "Перевод превышает доступный кредитный лимит.",
  DATE_OUT_OF_RANGE: "Дата перевода слишком далека от текущей.",
  IDEMPOTENCY_CONFLICT:
    "Этот идентификатор запроса уже использован с другими данными.",
  IDEMPOTENCY_IN_PROGRESS: "Перевод уже выполняется. Повторите запрос позже.",
};

export class TransferError extends Error {
  override readonly name = "TransferError";
  readonly code: TransferErrorCode;

  constructor(code: TransferErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.code = code;
  }
}

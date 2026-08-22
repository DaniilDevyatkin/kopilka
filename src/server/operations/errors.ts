import "server-only";

export type OperationErrorCode =
  | "INVALID_INPUT"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_ARCHIVED"
  | "INSUFFICIENT_AVAILABLE_FUNDS"
  | "CREDIT_LIMIT_EXCEEDED"
  | "DATE_OUT_OF_RANGE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "OPERATION_NOT_FOUND"
  | "OPERATION_IMMUTABLE";

const PUBLIC_MESSAGES: Record<OperationErrorCode, string> = {
  INVALID_INPUT: "Проверьте данные операции.",
  ACCOUNT_NOT_FOUND: "Счёт не найден.",
  ACCOUNT_ARCHIVED: "Архивный счёт нельзя изменять финансовой операцией.",
  INSUFFICIENT_AVAILABLE_FUNDS:
    "Недостаточно доступных средств на выбранном счёте.",
  CREDIT_LIMIT_EXCEEDED: "Сумма долга превышает установленный кредитный лимит.",
  DATE_OUT_OF_RANGE: "Дата операции слишком далека от текущей.",
  IDEMPOTENCY_CONFLICT:
    "Этот идентификатор операции уже использован с другими данными.",
  IDEMPOTENCY_IN_PROGRESS: "Операция уже выполняется. Повторите запрос позже.",
  OPERATION_NOT_FOUND: "Операция не найдена.",
  OPERATION_IMMUTABLE:
    "Эта операция уже отменена, изменена или недоступна для редактирования.",
};

export class OperationError extends Error {
  override readonly name = "OperationError";
  readonly code: OperationErrorCode;

  constructor(code: OperationErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.code = code;
  }
}

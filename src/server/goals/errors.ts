import "server-only";

export type GoalErrorCode =
  | "INVALID_INPUT"
  | "GOAL_NOT_FOUND"
  | "GOAL_NOT_EDITABLE"
  | "GOAL_NOT_RESTORABLE"
  | "GOAL_NOT_ACTIVE"
  | "TARGET_DATE_IN_PAST"
  | "IMAGE_NOT_FOUND"
  | "IMAGE_ALREADY_USED"
  | "ACTIVE_RESERVATION"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_ARCHIVED"
  | "INSUFFICIENT_ACCOUNT_AVAILABLE"
  | "INSUFFICIENT_GOAL_RESERVE"
  | "IDEMPOTENCY_CONFLICT"
  | "IDEMPOTENCY_IN_PROGRESS";

const PUBLIC_MESSAGES: Record<GoalErrorCode, string> = {
  INVALID_INPUT: "Проверьте данные цели.",
  GOAL_NOT_FOUND: "Цель не найдена.",
  GOAL_NOT_EDITABLE: "Эту цель больше нельзя редактировать.",
  GOAL_NOT_RESTORABLE: "Эту цель нельзя вернуть в активные.",
  GOAL_NOT_ACTIVE: "Неактивную цель нельзя пополнять или снимать с неё резерв.",
  TARGET_DATE_IN_PAST: "Дата цели не может быть в прошлом.",
  IMAGE_NOT_FOUND: "Изображение цели не найдено.",
  IMAGE_ALREADY_USED: "Это изображение уже связано с другой целью.",
  ACTIVE_RESERVATION:
    "Перед архивированием нужно безопасно освободить резерв цели.",
  ACCOUNT_NOT_FOUND: "Счёт не найден.",
  ACCOUNT_ARCHIVED: "Архивный счёт нельзя использовать для резерва.",
  INSUFFICIENT_ACCOUNT_AVAILABLE:
    "Недостаточно свободных средств на выбранном счёте.",
  INSUFFICIENT_GOAL_RESERVE:
    "Нельзя снять больше, чем зарезервировано на этом счёте для цели.",
  IDEMPOTENCY_CONFLICT:
    "Этот идентификатор запроса уже использован с другими данными.",
  IDEMPOTENCY_IN_PROGRESS:
    "Запрос уже выполняется. Повторите попытку немного позже.",
};

export class GoalError extends Error {
  override readonly name = "GoalError";
  readonly code: GoalErrorCode;

  constructor(code: GoalErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.code = code;
  }
}

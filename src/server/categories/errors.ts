import "server-only";

export type CategoryErrorCode = "INVALID_INPUT" | "CATEGORY_NOT_FOUND";

const PUBLIC_MESSAGES: Record<CategoryErrorCode, string> = {
  INVALID_INPUT: "Проверьте данные категории.",
  CATEGORY_NOT_FOUND: "Категория не найдена.",
};

export class CategoryError extends Error {
  override readonly name = "CategoryError";
  readonly code: CategoryErrorCode;

  constructor(code: CategoryErrorCode) {
    super(PUBLIC_MESSAGES[code]);
    this.code = code;
  }
}

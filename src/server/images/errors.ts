import "server-only";

export type ImageErrorCode =
  | "IMAGE_TOO_LARGE"
  | "UNSUPPORTED_IMAGE_FORMAT"
  | "IMAGE_DIMENSIONS_TOO_LARGE"
  | "INVALID_IMAGE"
  | "IMAGE_NOT_FOUND"
  | "STORAGE_UNAVAILABLE";

export const IMAGE_ERROR_MESSAGES: Record<ImageErrorCode, string> = {
  IMAGE_TOO_LARGE: "Изображение слишком большое.",
  UNSUPPORTED_IMAGE_FORMAT: "Поддерживаются только PNG, JPEG и WebP.",
  IMAGE_DIMENSIONS_TOO_LARGE: "Изображение слишком большое по размерам.",
  INVALID_IMAGE: "Файл не является корректным изображением.",
  IMAGE_NOT_FOUND: "Изображение цели не найдено.",
  STORAGE_UNAVAILABLE: "Хранилище изображений временно недоступно.",
};

export class ImageError extends Error {
  override readonly name = "ImageError";
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode) {
    super(IMAGE_ERROR_MESSAGES[code]);
    this.code = code;
  }
}

export function imageErrorStatus(error: ImageError): number {
  switch (error.code) {
    case "IMAGE_TOO_LARGE":
      return 413;
    case "UNSUPPORTED_IMAGE_FORMAT":
      return 415;
    case "IMAGE_DIMENSIONS_TOO_LARGE":
    case "INVALID_IMAGE":
      return 422;
    case "IMAGE_NOT_FOUND":
      return 404;
    case "STORAGE_UNAVAILABLE":
      return 503;
  }
}

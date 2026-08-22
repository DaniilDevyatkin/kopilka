import "server-only";

import { getServerEnvironment } from "@/lib/env/server";
import { AuthError } from "@/server/auth/errors";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import {
  IMAGE_ERROR_MESSAGES,
  ImageError,
  imageErrorStatus,
} from "@/server/images/errors";
import { MAX_UPLOAD_BYTES, imageService } from "@/server/images";

export const dynamic = "force-dynamic";

const MULTIPART_OVERHEAD_BUDGET = 64 * 1024;

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireAuthenticatedUser();
    assertSameOrigin(request.headers, getServerEnvironment().APP_ORIGIN);
    await imageService.sweepUnlinkedImages(user.id);

    const contentLength = Number.parseInt(
      request.headers.get("content-length") ?? "",
      10,
    );
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BUDGET
    ) {
      return errorResponse(
        413,
        "IMAGE_TOO_LARGE",
        IMAGE_ERROR_MESSAGES.IMAGE_TOO_LARGE,
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse(400, "INVALID_INPUT", "Файл не передан.");
    }
    const asset = await imageService.upload(
      user.id,
      new Uint8Array(await file.arrayBuffer()),
    );
    return Response.json(
      { ...asset, byteSize: Number(asset.byteSize) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ImageError) {
      return errorResponse(imageErrorStatus(error), error.code, error.message);
    }
    if (error instanceof AuthError) {
      return errorResponse(401, error.code, error.message);
    }
    if (error instanceof SameOriginError) {
      return errorResponse(
        403,
        "INVALID_INPUT",
        "Не удалось подтвердить запрос.",
      );
    }
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Не удалось загрузить изображение.",
    );
  }
}

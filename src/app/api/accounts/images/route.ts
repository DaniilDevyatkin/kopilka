import "server-only";

import { getServerEnvironment } from "@/lib/env/server";
import { AuthError } from "@/server/auth/errors";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import { MAX_UPLOAD_BYTES, imageService } from "@/server/images";
import {
  IMAGE_ERROR_MESSAGES,
  ImageError,
  imageErrorStatus,
} from "@/server/images/errors";

export const dynamic = "force-dynamic";
const MULTIPART_OVERHEAD_BUDGET = 64 * 1024;

function failure(status: number, code: string, message: string) {
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
      return failure(
        413,
        "IMAGE_TOO_LARGE",
        IMAGE_ERROR_MESSAGES.IMAGE_TOO_LARGE,
      );
    }
    const file = (await request.formData()).get("file");
    if (!(file instanceof File))
      return failure(400, "INVALID_INPUT", "Файл не передан.");
    const asset = await imageService.upload(
      user.id,
      new Uint8Array(await file.arrayBuffer()),
      "accounts",
    );
    return Response.json(
      { ...asset, byteSize: Number(asset.byteSize) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ImageError)
      return failure(imageErrorStatus(error), error.code, error.message);
    if (error instanceof AuthError)
      return failure(401, error.code, error.message);
    if (error instanceof SameOriginError)
      return failure(403, "INVALID_INPUT", "Не удалось подтвердить запрос.");
    return failure(500, "INTERNAL_ERROR", "Не удалось загрузить изображение.");
  }
}

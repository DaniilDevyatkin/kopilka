import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "@/lib/env/server";
import { AuthError } from "@/server/auth/errors";
import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import { ImageError, imageErrorStatus } from "@/server/images/errors";
import { imageService } from "@/server/images";

export const dynamic = "force-dynamic";

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ ok: false, code, message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) {
    return errorResponse(
      404,
      "IMAGE_NOT_FOUND",
      "Изображение цели не найдено.",
    );
  }
  try {
    const user = await requireAuthenticatedUser();
    const image = await imageService.download(user.id, assetId);
    return new Response(Buffer.from(image.bytes), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.byteSize),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ImageError) {
      return errorResponse(imageErrorStatus(error), error.code, error.message);
    }
    if (error instanceof AuthError) {
      return errorResponse(401, error.code, error.message);
    }
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Не удалось загрузить изображение.",
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) {
    return errorResponse(
      404,
      "IMAGE_NOT_FOUND",
      "Изображение цели не найдено.",
    );
  }
  try {
    assertSameOrigin(request.headers, getServerEnvironment().APP_ORIGIN);
    const user = await requireAuthenticatedUser();
    await imageService.deleteImage(user.id, assetId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(401, error.code, error.message);
    if (error instanceof SameOriginError)
      return errorResponse(
        403,
        "INVALID_INPUT",
        "Не удалось подтвердить запрос.",
      );
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Не удалось удалить изображение.",
    );
  }
}

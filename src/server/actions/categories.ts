"use server";

import "server-only";

import { headers } from "next/headers";

import { getServerEnvironment } from "@/lib/env/server";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import { CategoryError } from "@/server/categories/errors";
import { categoryService } from "@/server/categories/index";
import type {
  CategoryReadModel,
  CreateCategoryInput,
} from "@/server/categories/service";
import { listCategoriesForCurrentUser } from "@/server/categories/current-user";
import { requireAuthenticatedUser } from "@/server/auth/current-user";

export type CategoryActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

function sanitizedFailure(error: unknown): {
  ok: false;
  code: string;
  message: string;
} {
  if (error instanceof CategoryError) {
    return { ok: false, code: error.code, message: error.message };
  }
  if (error instanceof SameOriginError) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Не удалось подтвердить запрос.",
    };
  }
  return {
    ok: false,
    code: "INVALID_INPUT",
    message: "Не удалось выполнить запрос.",
  };
}

async function assertMutationSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  assertSameOrigin(requestHeaders, getServerEnvironment().APP_ORIGIN);
}

export async function listCategoriesAction(
  kind: unknown,
): Promise<CategoryActionResult<CategoryReadModel[]>> {
  try {
    return { ok: true, data: await listCategoriesForCurrentUser(kind) };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function createCategoryAction(
  input: CreateCategoryInput,
): Promise<CategoryActionResult<CategoryReadModel>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    return {
      ok: true,
      data: await categoryService.createCategory(userId, input),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

export async function archiveCategoryAction(
  categoryId: unknown,
): Promise<CategoryActionResult<CategoryReadModel>> {
  try {
    await assertMutationSameOrigin();
    const userId = (await requireAuthenticatedUser()).id;
    return {
      ok: true,
      data: await categoryService.archiveCategory(userId, categoryId),
    };
  } catch (error) {
    return sanitizedFailure(error);
  }
}

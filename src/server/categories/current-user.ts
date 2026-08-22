import "server-only";

import { requireAuthenticatedUser } from "@/server/auth/current-user";
import { categoryService } from "@/server/categories/index";
import type { CreateCategoryInput } from "@/server/categories/service";

async function authenticatedUserId(): Promise<string> {
  return (await requireAuthenticatedUser()).id;
}

export async function listCategoriesForCurrentUser(kind: unknown) {
  return categoryService.listCategories(await authenticatedUserId(), kind);
}

export async function createCategoryForCurrentUser(input: CreateCategoryInput) {
  return categoryService.createCategory(await authenticatedUserId(), input);
}

export async function archiveCategoryForCurrentUser(categoryId: unknown) {
  return categoryService.archiveCategory(
    await authenticatedUserId(),
    categoryId,
  );
}

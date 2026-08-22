import "server-only";

import { randomUUID } from "node:crypto";

import type { Category, PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AppIconName } from "@/components/icons";
import { CategoryError } from "@/server/categories/errors";
import {
  CUSTOM_CATEGORY_ICONS,
  categoryIdSchema,
  createCategoryInputSchema,
  categoryKindSchema,
  type CreateCategoryInput,
} from "@/server/categories/validation";
import { SYSTEM_CATEGORIES } from "@/lib/categories/catalog";

type CategoryDatabase = PrismaClient | Prisma.TransactionClient;

interface CategoryServiceDependencies {
  database: PrismaClient;
  now?: () => Date;
}

export interface CategoryReadModel {
  id: string;
  kind: Category["kind"];
  slug: string;
  labelRu: string;
  iconName: AppIconName;
  sortOrder: number;
  system: boolean;
  archivedAt: Date | null;
}

const CUSTOM_SORT_ORDER = 1000;
const ALLOWED_CATEGORY_ICONS = new Set<string>([
  ...SYSTEM_CATEGORIES.map((category) => category.iconName),
  ...CUSTOM_CATEGORY_ICONS,
]);

function systemCatalogForKind(kind: Category["kind"]) {
  return SYSTEM_CATEGORIES.filter((category) => category.kind === kind);
}

function assertParsed<T>(
  result: { success: true; data: T } | { success: false },
): T {
  if (!result.success) throw new CategoryError("INVALID_INPUT");
  return result.data;
}

function toReadModel(category: Category): CategoryReadModel {
  if (!ALLOWED_CATEGORY_ICONS.has(category.iconName)) {
    throw new CategoryError("CATEGORY_NOT_FOUND");
  }
  return {
    id: category.id,
    kind: category.kind,
    slug: category.slug,
    labelRu: category.labelRu,
    iconName: category.iconName as AppIconName,
    sortOrder: category.sortOrder,
    system: category.ownerUserId === null,
    archivedAt: category.archivedAt,
  };
}

export function createCategoryService(
  dependencies: CategoryServiceDependencies,
) {
  const now = dependencies.now ?? (() => new Date());

  async function ensureSystemCategories(
    database: CategoryDatabase,
  ): Promise<void> {
    const existing = await database.category.findMany({
      where: {
        ownerUserId: null,
        OR: SYSTEM_CATEGORIES.map((category) => ({
          kind: category.kind,
          slug: category.slug,
        })),
      },
      select: {
        kind: true,
        slug: true,
        labelRu: true,
        iconName: true,
        sortOrder: true,
        archivedAt: true,
      },
    });
    const existingByKey = new Map(
      existing.map((category) => [
        `${category.kind}:${category.slug}`,
        category,
      ]),
    );
    const catalogIsCanonical = SYSTEM_CATEGORIES.every((category) => {
      const stored = existingByKey.get(`${category.kind}:${category.slug}`);
      return (
        stored?.labelRu === category.labelRu &&
        stored.iconName === category.iconName &&
        stored.sortOrder === category.sortOrder &&
        stored.archivedAt === null
      );
    });
    if (catalogIsCanonical && existing.length === SYSTEM_CATEGORIES.length) {
      return;
    }

    await database.category.createMany({
      data: SYSTEM_CATEGORIES.map((category) => ({
        kind: category.kind,
        slug: category.slug,
        labelRu: category.labelRu,
        iconName: category.iconName,
        sortOrder: category.sortOrder,
      })),
      skipDuplicates: true,
    });
    for (const category of SYSTEM_CATEGORIES) {
      await database.category.updateMany({
        where: {
          ownerUserId: null,
          kind: category.kind,
          slug: category.slug,
        },
        data: {
          labelRu: category.labelRu,
          iconName: category.iconName,
          sortOrder: category.sortOrder,
          archivedAt: null,
        },
      });
    }
  }

  async function listCategories(
    userId: string,
    kindInput: unknown,
  ): Promise<CategoryReadModel[]> {
    const kind = assertParsed(categoryKindSchema.safeParse(kindInput));
    await ensureSystemCategories(dependencies.database);
    const systemSlugs = systemCatalogForKind(kind).map(
      (category) => category.slug,
    );
    const rows = await dependencies.database.category.findMany({
      where: {
        kind,
        archivedAt: null,
        OR: [
          { ownerUserId: null, slug: { in: systemSlugs } },
          { ownerUserId: userId },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { labelRu: "asc" }],
    });
    return rows.map(toReadModel);
  }

  async function createCategory(
    userId: string,
    inputValue: CreateCategoryInput,
  ): Promise<CategoryReadModel> {
    const input = assertParsed(createCategoryInputSchema.safeParse(inputValue));
    await ensureSystemCategories(dependencies.database);
    const slug = `custom-${randomUUID().replaceAll("-", "")}`;
    const category = await dependencies.database.category.create({
      data: {
        ownerUserId: userId,
        kind: input.kind,
        slug,
        labelRu: input.labelRu,
        iconName: input.iconName,
        sortOrder: CUSTOM_SORT_ORDER,
      },
    });
    return toReadModel(category);
  }

  async function archiveCategory(
    userId: string,
    categoryIdInput: unknown,
  ): Promise<CategoryReadModel> {
    const categoryId = assertParsed(
      categoryIdSchema.safeParse(categoryIdInput),
    );
    await ensureSystemCategories(dependencies.database);
    const category = await dependencies.database.category.findFirst({
      where: { id: categoryId, ownerUserId: userId },
    });
    if (!category) throw new CategoryError("CATEGORY_NOT_FOUND");
    if (category.archivedAt) return toReadModel(category);
    const archived = await dependencies.database.category.update({
      where: { id: category.id },
      data: { archivedAt: now() },
    });
    return toReadModel(archived);
  }

  async function resolveOperationCategory(
    database: CategoryDatabase,
    userId: string,
    kindInput: unknown,
    categoryIdInput: unknown,
  ): Promise<Category> {
    const kind = assertParsed(categoryKindSchema.safeParse(kindInput));
    const categoryId = assertParsed(
      categoryIdSchema.safeParse(categoryIdInput),
    );
    await ensureSystemCategories(database);
    const systemSlugs = systemCatalogForKind(kind).map(
      (category) => category.slug,
    );
    const category = await database.category.findFirst({
      where: {
        id: categoryId,
        kind,
        archivedAt: null,
        OR: [
          { ownerUserId: userId },
          { ownerUserId: null, slug: { in: systemSlugs } },
        ],
      },
    });
    if (!category) throw new CategoryError("CATEGORY_NOT_FOUND");
    return category;
  }

  return {
    ensureSystemCategories,
    listCategories,
    createCategory,
    archiveCategory,
    resolveOperationCategory,
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
export type { CreateCategoryInput };

import "server-only";

import { z } from "zod";

import { CORE_ICON_NAMES } from "@/components/icons";
import { CATEGORY_KINDS } from "@/lib/categories/catalog";

export const categoryKindSchema = z.enum(CATEGORY_KINDS);

export const CUSTOM_CATEGORY_ICONS = [
  "card",
  "cash",
  "savings",
  "bank-account",
  "custom-account",
  "target",
  "categories",
] as const satisfies readonly (typeof CORE_ICON_NAMES)[number][];

export const createCategoryInputSchema = z
  .object({
    kind: categoryKindSchema,
    labelRu: z.string().trim().min(1).max(80),
    iconName: z.enum(CUSTOM_CATEGORY_ICONS),
  })
  .strict();

export const categoryIdSchema = z.uuid();

export type CreateCategoryInput = z.input<typeof createCategoryInputSchema>;
export type ParsedCreateCategoryInput = z.output<
  typeof createCategoryInputSchema
>;

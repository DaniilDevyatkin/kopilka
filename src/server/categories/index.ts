import "server-only";

import { createCategoryService } from "@/server/categories/service";
import { prisma } from "@/server/db/prisma";

export const categoryService = createCategoryService({ database: prisma });

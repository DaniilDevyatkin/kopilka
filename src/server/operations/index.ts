import "server-only";

import { categoryService } from "@/server/categories/index";
import { createOperationService } from "@/server/operations/service";
import { prisma } from "@/server/db/prisma";

export const operationService = createOperationService({
  database: prisma,
  resolveOperationCategory: categoryService.resolveOperationCategory,
});

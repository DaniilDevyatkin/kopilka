import "server-only";

import { prisma } from "@/server/db/prisma";
import { imageService } from "@/server/images";
import { createGoalService } from "@/server/goals/service";

export const goalService = createGoalService({
  database: prisma,
  reclaimImage: (userId, imageAssetId) =>
    imageService.deleteImage(userId, imageAssetId),
});

import "server-only";

import { createAccountService } from "@/server/accounts/service";
import { prisma } from "@/server/db/prisma";
import { imageService } from "@/server/images";

export const accountService = createAccountService({
  database: prisma,
  reclaimImage: (userId, imageAssetId) =>
    imageService.deleteImage(userId, imageAssetId),
});

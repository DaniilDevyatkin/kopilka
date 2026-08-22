import "server-only";

import { getServerEnvironment } from "@/lib/env/server";
import { prisma } from "@/server/db/prisma";
import { createImageService } from "@/server/images/service";
import { createStorageAdapter } from "@/server/images/storage";

export { MAX_IMAGE_DIMENSION, MAX_UPLOAD_BYTES } from "@/server/images/service";

const environment = getServerEnvironment();

export const imageService = createImageService({
  database: prisma,
  storage: createStorageAdapter(
    environment.STORAGE_DRIVER,
    environment.STORAGE_LOCAL_DIRECTORY,
    environment.STORAGE_DRIVER === "s3"
      ? {
          endpoint:
            environment.STORAGE_ENDPOINT ||
            `https://s3.${environment.STORAGE_REGION}.amazonaws.com`,
          bucket: environment.STORAGE_BUCKET ?? "",
          region: environment.STORAGE_REGION,
          accessKeyId: environment.STORAGE_ACCESS_KEY_ID ?? "",
          secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY ?? "",
        }
      : undefined,
  ),
});

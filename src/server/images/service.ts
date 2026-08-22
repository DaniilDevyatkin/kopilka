import "server-only";

import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";

import type { PrismaClient } from "@/generated/prisma/client";
import { ImageError } from "@/server/images/errors";
import type { StorageAdapter } from "@/server/images/storage";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"] as const);
type AllowedFormat = "jpeg" | "png" | "webp";

const MIME_BY_FORMAT: Record<AllowedFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSION_BY_FORMAT: Record<AllowedFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export interface ImageServiceDependencies {
  database: PrismaClient;
  storage: StorageAdapter;
  now?: () => Date;
}

export interface ImageAssetReadModel {
  id: string;
  mimeType: string;
  byteSize: bigint;
  width: number;
  height: number;
  integrityHash: string | null;
  createdAt: Date;
}

export interface DownloadedImage extends ImageAssetReadModel {
  bytes: Uint8Array;
}

interface ProcessedImage {
  format: AllowedFormat;
  bytes: Uint8Array;
  width: number;
  height: number;
}

async function processImage(bytes: Uint8Array): Promise<ProcessedImage> {
  try {
    const image = sharp(Buffer.from(bytes), {
      failOn: "error",
      autoOrient: true,
      limitInputPixels: MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION,
    });
    const metadata = await image.metadata();
    const format = metadata.format as string | undefined;
    if (!format || !ALLOWED_FORMATS.has(format as AllowedFormat)) {
      throw new ImageError("UNSUPPORTED_IMAGE_FORMAT");
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION
    ) {
      throw new ImageError("IMAGE_DIMENSIONS_TOO_LARGE");
    }
    const output = await image.toFormat(format as AllowedFormat).toBuffer();
    const outputMetadata = await sharp(output).metadata();
    return {
      format: format as AllowedFormat,
      bytes: output,
      width: outputMetadata.width ?? metadata.width,
      height: outputMetadata.height ?? metadata.height,
    };
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError("INVALID_IMAGE");
  }
}

export function createImageService(dependencies: ImageServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());

  async function upload(
    userId: string,
    bytes: Uint8Array,
    scope: "goals" | "accounts" = "goals",
  ): Promise<ImageAssetReadModel> {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new ImageError("IMAGE_TOO_LARGE");
    }
    const processed = await processImage(bytes);
    const storageKey = `${scope}/${userId}/${randomUUID()}.${EXTENSION_BY_FORMAT[processed.format]}`;
    const integrityHash = createHash("sha256")
      .update(Buffer.from(processed.bytes))
      .digest("hex");
    try {
      await dependencies.storage.put(storageKey, processed.bytes);
    } catch {
      throw new ImageError("STORAGE_UNAVAILABLE");
    }
    try {
      const asset = await dependencies.database.imageAsset.create({
        data: {
          userId,
          storageKey,
          mimeType: MIME_BY_FORMAT[processed.format],
          byteSize: BigInt(processed.bytes.byteLength),
          width: processed.width,
          height: processed.height,
          integrityHash,
          createdAt: now(),
        },
      });
      return {
        id: asset.id,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        width: asset.width,
        height: asset.height,
        integrityHash: asset.integrityHash,
        createdAt: asset.createdAt,
      };
    } catch (error) {
      await dependencies.storage.delete(storageKey).catch(() => {});
      throw error;
    }
  }

  async function download(
    userId: string,
    assetId: string,
  ): Promise<DownloadedImage> {
    const asset = await dependencies.database.imageAsset.findFirst({
      where: { id: assetId, userId, deletedAt: null },
    });
    if (!asset) throw new ImageError("IMAGE_NOT_FOUND");
    let bytes: Uint8Array | null;
    try {
      bytes = await dependencies.storage.get(asset.storageKey);
    } catch {
      throw new ImageError("STORAGE_UNAVAILABLE");
    }
    if (!bytes) throw new ImageError("IMAGE_NOT_FOUND");
    return {
      id: asset.id,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
      integrityHash: asset.integrityHash,
      createdAt: asset.createdAt,
      bytes,
    };
  }

  async function deleteImage(userId: string, assetId: string): Promise<void> {
    const asset = await dependencies.database.imageAsset.findFirst({
      where: { id: assetId, userId, deletedAt: null },
    });
    if (!asset) return;
    await dependencies.database.imageAsset.update({
      where: { id: asset.id },
      data: { deletedAt: now() },
    });
    // Best-effort physical delete; sweepOrphanFiles covers transient failures.
    await dependencies.storage.delete(asset.storageKey).catch(() => {});
  }

  async function sweepOrphanFiles(userId: string): Promise<number> {
    const keys = await dependencies.storage.list(userId);
    if (keys.length === 0) return 0;
    const rows = await dependencies.database.imageAsset.findMany({
      where: { userId, storageKey: { in: keys } },
      select: { storageKey: true, deletedAt: true },
    });
    const activeKeys = new Set(
      rows.filter((row) => row.deletedAt === null).map((row) => row.storageKey),
    );
    let removed = 0;
    for (const key of keys) {
      if (activeKeys.has(key)) continue;
      await dependencies.storage.delete(key);
      removed += 1;
    }
    return removed;
  }

  async function sweepUnlinkedImages(userId: string): Promise<number> {
    const threshold = new Date(now().getTime() - 24 * 60 * 60 * 1000);
    const assets = await dependencies.database.imageAsset.findMany({
      where: {
        userId,
        deletedAt: null,
        createdAt: { lt: threshold },
        goal: null,
        account: null,
      },
      select: { id: true, storageKey: true },
      take: 50,
    });
    for (const asset of assets) {
      await dependencies.database.imageAsset.updateMany({
        where: { id: asset.id, userId, deletedAt: null },
        data: { deletedAt: now() },
      });
      await dependencies.storage.delete(asset.storageKey).catch(() => {});
    }
    return assets.length;
  }

  return {
    upload,
    download,
    deleteImage,
    sweepOrphanFiles,
    sweepUnlinkedImages,
  };
}

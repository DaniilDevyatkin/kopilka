import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import { Currency, type PrismaClient } from "@/generated/prisma/client";
import { GoalError } from "@/server/goals/errors";
import {
  createGoalService,
  type CreateGoalInput,
} from "@/server/goals/service";
import { ImageError, imageErrorStatus } from "@/server/images/errors";
import {
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  createImageService,
  type ImageAssetReadModel,
} from "@/server/images/service";
import { LocalStorageAdapter } from "@/server/images/storage";
import {
  createImageTestClient,
  prepareImageTestDatabase,
} from "./image-test-database";

const NOW = new Date("2026-08-11T10:00:00.000Z");
let database: PrismaClient;
let storage: LocalStorageAdapter;
let uploadDirectory: string;

async function createUser(label: string) {
  return database.user.create({
    data: {
      loginNormalized: `${label}-${randomUUID()}`,
      loginDisplay: label,
      passwordHash: "integration-test-password-hash",
      baseCurrency: Currency.RUB,
      settings: { create: { timeZone: "Europe/Moscow" } },
      onboardingState: { create: {} },
      notification: { create: {} },
    },
  });
}

function imageService() {
  return createImageService({
    database,
    storage,
    now: () => new Date(NOW),
  });
}

function goalService() {
  return createGoalService({
    database,
    now: () => new Date(NOW),
    reclaimImage: (userId, imageAssetId) =>
      imageService().deleteImage(userId, imageAssetId),
  });
}

function createGoalInput(
  overrides: Partial<CreateGoalInput> = {},
): CreateGoalInput {
  return {
    name: "MacBook",
    category: "TECH",
    targetAmountMinor: 160_000_00n,
    targetDate: "2027-04-18",
    priority: "MEDIUM",
    idempotencyKey: `goal-create-${randomUUID()}`,
    ...overrides,
  };
}

function generatedBytes(
  format: "png" | "jpeg" | "webp",
  width = 64,
  height = 32,
) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    [format]()
    .toBuffer();
}

async function upload(
  userId: string,
  bytes: Uint8Array,
): Promise<ImageAssetReadModel> {
  return imageService().upload(userId, bytes);
}

async function storedFileBytes(storageKey: string): Promise<Uint8Array> {
  const bytes = await storage.get(storageKey);
  if (!bytes) throw new Error(`Missing file for ${storageKey}`);
  return bytes;
}

beforeAll(async () => {
  await prepareImageTestDatabase();
  database = createImageTestClient();
  uploadDirectory = await mkdtemp(path.join(os.tmpdir(), "kopilka-images-"));
  storage = new LocalStorageAdapter(uploadDirectory);
});

beforeEach(async () => {
  await database.goalReservationEntry.deleteMany();
  await database.ledgerEntry.deleteMany();
  await database.financialOperation.deleteMany();
  await database.idempotencyKey.deleteMany();
  await database.goal.deleteMany();
  await database.imageAsset.deleteMany();
  await database.account.deleteMany();
  await database.category.deleteMany();
  await database.notificationPreference.deleteMany();
  await database.onboardingState.deleteMany();
  await database.userSettings.deleteMany();
  await database.user.deleteMany();
  for (const entry of await readdir(uploadDirectory, { withFileTypes: true })) {
    await rm(path.join(uploadDirectory, entry.name), {
      recursive: true,
      force: true,
    });
  }
});

afterAll(async () => {
  await rm(uploadDirectory, { recursive: true, force: true });
  await database.$disconnect();
});

describe("server-only goal image storage", () => {
  it("uploads PNG with a server-generated key and verified metadata", async () => {
    const user = await createUser("png");
    const input = await generatedBytes("png");
    const asset = await upload(user.id, input);

    const row = await database.imageAsset.findUnique({
      where: { id: asset.id },
    });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(user.id);
    expect(row?.storageKey).toMatch(
      new RegExp(`^goals/${user.id}/[0-9a-f-]{36}\\.png$`),
    );
    expect(row?.mimeType).toBe("image/png");
    expect(row?.width).toBe(64);
    expect(row?.height).toBe(32);
    expect(row?.deletedAt).toBeNull();

    const files = await storage.list(user.id);
    expect(files).toEqual([row!.storageKey]);
    const stored = await storedFileBytes(row!.storageKey);
    expect(asset.byteSize).toBe(BigInt(stored.byteLength));
    expect(row?.integrityHash).toBe(
      createHash("sha256").update(Buffer.from(stored)).digest("hex"),
    );
    expect(asset).toMatchObject({
      id: row!.id,
      mimeType: "image/png",
      byteSize: BigInt(stored.byteLength),
      width: 64,
      height: 32,
      integrityHash: row!.integrityHash,
    });
    expect(asset.createdAt).toBeInstanceOf(Date);
  });

  it("accepts JPEG and WebP with MIME detected by signature, not by a client filename", async () => {
    const user = await createUser("formats");
    for (const [format, expectedMime, extension] of [
      ["jpeg", "image/jpeg", "jpg"],
      ["webp", "image/webp", "webp"],
    ] as const) {
      const asset = await upload(user.id, await generatedBytes(format));
      const row = await database.imageAsset.findUnique({
        where: { id: asset.id },
      });
      expect(row?.mimeType).toBe(expectedMime);
      expect(row?.storageKey).toMatch(
        new RegExp(`^goals/${user.id}/[0-9a-f-]{36}\\.${extension}$`),
      );
      expect(asset.mimeType).toBe(expectedMime);
    }
  });

  it("rejects SVG uploads", async () => {
    const user = await createUser("svg");
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">' +
        '<rect width="8" height="8" fill="red"/></svg>',
    );
    await expect(upload(user.id, svg)).rejects.toEqual(
      new ImageError("UNSUPPORTED_IMAGE_FORMAT"),
    );
    expect(await storage.list(user.id)).toEqual([]);
  });

  it("rejects non-image bytes", async () => {
    const user = await createUser("garbage");
    await expect(upload(user.id, Buffer.from("not an image"))).rejects.toEqual(
      new ImageError("INVALID_IMAGE"),
    );
    expect(await storage.list(user.id)).toEqual([]);
  });

  it("rejects files larger than the upload limit before decoding", async () => {
    const user = await createUser("oversized");
    await expect(
      upload(user.id, new Uint8Array(MAX_UPLOAD_BYTES + 1)),
    ).rejects.toEqual(new ImageError("IMAGE_TOO_LARGE"));
    expect(await storage.list(user.id)).toEqual([]);
  });

  it("rejects images with a dimension above the limit and accepts the boundary", async () => {
    const user = await createUser("dimensions");
    await expect(
      upload(user.id, await generatedBytes("png", MAX_IMAGE_DIMENSION + 1, 8)),
    ).rejects.toEqual(new ImageError("IMAGE_DIMENSIONS_TOO_LARGE"));
    const boundary = await upload(
      user.id,
      await generatedBytes("png", MAX_IMAGE_DIMENSION, 8),
    );
    expect(boundary.width).toBe(MAX_IMAGE_DIMENSION);
    expect(await storage.list(user.id)).toHaveLength(1);
  });

  it("downloads an owned image with bytes and metadata", async () => {
    const user = await createUser("download");
    const asset = await upload(user.id, await generatedBytes("webp", 32, 24));
    const downloaded = await imageService().download(user.id, asset.id);

    expect(downloaded.mimeType).toBe("image/webp");
    expect(downloaded.byteSize).toBe(asset.byteSize);
    expect(downloaded.width).toBe(32);
    expect(downloaded.height).toBe(24);
    expect(downloaded.integrityHash).toBe(asset.integrityHash);
    const row = await database.imageAsset.findUnique({
      where: { id: asset.id },
    });
    expect(downloaded.bytes).toEqual(await storedFileBytes(row!.storageKey));
  });

  it("never exposes another user's image and hides missing assets", async () => {
    const owner = await createUser("owner");
    const stranger = await createUser("stranger");
    const asset = await upload(owner.id, await generatedBytes("png"));

    await expect(
      imageService().download(stranger.id, asset.id),
    ).rejects.toEqual(new ImageError("IMAGE_NOT_FOUND"));
    await expect(
      imageService().download(owner.id, randomUUID()),
    ).rejects.toEqual(new ImageError("IMAGE_NOT_FOUND"));
  });

  it("rejects attaching another user's image to a goal", async () => {
    const owner = await createUser("owner");
    const stranger = await createUser("stranger");
    const asset = await upload(owner.id, await generatedBytes("png"));

    await expect(
      goalService().createGoal(
        stranger.id,
        createGoalInput({ imageAssetId: asset.id }),
      ),
    ).rejects.toEqual(new GoalError("IMAGE_NOT_FOUND"));
  });

  it("soft-deletes the asset and removes the file on deleteImage", async () => {
    const user = await createUser("delete");
    const asset = await upload(user.id, await generatedBytes("png"));
    expect(await storage.list(user.id)).toHaveLength(1);

    await imageService().deleteImage(user.id, asset.id);

    const row = await database.imageAsset.findUnique({
      where: { id: asset.id },
    });
    expect(row?.deletedAt).toEqual(NOW);
    expect(await storage.list(user.id)).toEqual([]);
    await expect(imageService().download(user.id, asset.id)).rejects.toEqual(
      new ImageError("IMAGE_NOT_FOUND"),
    );
    await expect(
      imageService().deleteImage(user.id, asset.id),
    ).resolves.toBeUndefined();
  });

  it("replaces a goal image and reclaims the previous asset and file", async () => {
    const user = await createUser("replace");
    const first = await upload(user.id, await generatedBytes("png"));
    const second = await upload(user.id, await generatedBytes("webp"));

    const created = await goalService().createGoal(
      user.id,
      createGoalInput({ imageAssetId: first.id }),
    );
    const updated = await goalService().updateGoal(user.id, {
      goalId: created.goal.id,
      imageAssetId: second.id,
    });

    expect(updated.image?.id).toBe(second.id);
    const firstRow = await database.imageAsset.findUnique({
      where: { id: first.id },
    });
    expect(firstRow?.deletedAt).toEqual(NOW);
    expect(await storage.list(user.id)).toHaveLength(1);
    expect(
      await storage.get(
        (await database.imageAsset.findUnique({
          where: { id: second.id },
        }))!.storageKey,
      ),
    ).not.toBeNull();
  });

  it("removing the goal image reclaims its asset and file", async () => {
    const user = await createUser("remove");
    const asset = await upload(user.id, await generatedBytes("png"));
    const created = await goalService().createGoal(
      user.id,
      createGoalInput({ imageAssetId: asset.id }),
    );

    const updated = await goalService().updateGoal(user.id, {
      goalId: created.goal.id,
      imageAssetId: null,
    });

    expect(updated.image).toBeNull();
    expect(await storage.list(user.id)).toEqual([]);
    const row = await database.imageAsset.findUnique({
      where: { id: asset.id },
    });
    expect(row?.deletedAt).toEqual(NOW);
  });

  it("sweep removes files without an active record and keeps active ones", async () => {
    const user = await createUser("sweep");
    const asset = await upload(user.id, await generatedBytes("png"));
    const assetKey = (await database.imageAsset.findUnique({
      where: { id: asset.id },
    }))!.storageKey;

    const strayKey = `goals/${user.id}/stray-${randomUUID()}.png`;
    await storage.put(strayKey, new Uint8Array([1, 2, 3]));

    expect(await imageService().sweepOrphanFiles(user.id)).toBe(1);
    expect(await storage.list(user.id)).toEqual([assetKey]);

    await storage.put(assetKey, new Uint8Array([4, 5]));
    await database.imageAsset.update({
      where: { id: asset.id },
      data: { deletedAt: NOW },
    });
    expect(await imageService().sweepOrphanFiles(user.id)).toBe(1);
    expect(await storage.list(user.id)).toEqual([]);
  });

  it("maps every image error to an HTTP status", () => {
    expect(imageErrorStatus(new ImageError("IMAGE_TOO_LARGE"))).toBe(413);
    expect(imageErrorStatus(new ImageError("UNSUPPORTED_IMAGE_FORMAT"))).toBe(
      415,
    );
    expect(imageErrorStatus(new ImageError("IMAGE_DIMENSIONS_TOO_LARGE"))).toBe(
      422,
    );
    expect(imageErrorStatus(new ImageError("INVALID_IMAGE"))).toBe(422);
    expect(imageErrorStatus(new ImageError("IMAGE_NOT_FOUND"))).toBe(404);
    expect(imageErrorStatus(new ImageError("STORAGE_UNAVAILABLE"))).toBe(503);
  });
});

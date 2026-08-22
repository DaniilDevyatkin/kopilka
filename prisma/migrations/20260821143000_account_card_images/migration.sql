ALTER TABLE "accounts" ADD COLUMN "imageAssetId" UUID;

CREATE UNIQUE INDEX "accounts_imageAssetId_userId_key"
  ON "accounts"("imageAssetId", "userId");

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_imageAssetId_userId_fkey"
  FOREIGN KEY ("imageAssetId", "userId")
  REFERENCES "image_assets"("id", "userId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

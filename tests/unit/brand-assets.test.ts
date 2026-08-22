import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const rasterAssets = [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["icon-96.png", 96],
  ["icon-128.png", 128],
  ["icon-144.png", 144],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-256.png", 256],
  ["icon-384.png", 384],
  ["icon-512.png", 512],
  ["icon-maskable-192.png", 192],
  ["icon-maskable-512.png", 512],
] as const;

const svgAssets = [
  "public/logo-mark.svg",
  "public/logo-mark-reversed.svg",
  "public/logo-horizontal.svg",
  "public/favicon.svg",
  "src/assets/brand/app-icon-source.svg",
] as const;

describe("brand SVG sources", () => {
  it.each(svgAssets)(
    "keeps %s local, compact and vector-only",
    async (assetPath) => {
      const source = await readFile(path.resolve(assetPath), "utf8");
      const metadata = await stat(path.resolve(assetPath));

      expect(source).toContain("<svg");
      expect(source).toContain("viewBox=");
      expect(source).not.toMatch(
        /<(?:image|script|foreignObject|text|filter|metadata)\b/iu,
      );
      expect(
        source.replace('xmlns="http://www.w3.org/2000/svg"', ""),
      ).not.toMatch(/(?:https?:|data:|href=)/iu);
      expect(metadata.size).toBeLessThan(12_000);
    },
  );
});

describe("generated brand raster assets", () => {
  it.each(rasterAssets)(
    "renders %s at exactly %d square pixels",
    async (assetName, size) => {
      const image = sharp(path.resolve("public", assetName));
      const metadata = await image.metadata();
      const statistics = await image.stats();
      const alpha = statistics.channels[3];

      expect(metadata.format).toBe("png");
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
      expect(alpha?.min ?? 255).toBe(255);
      expect(alpha?.max ?? 255).toBe(255);
    },
  );

  it.each(["icon-maskable-192.png", "icon-maskable-512.png"])(
    "keeps every foreground pixel of %s inside the 80%% maskable circle",
    async (assetName) => {
      const { data, info } = await sharp(path.resolve("public", assetName))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const background = [0, 42, 31];
      const center = (info.width - 1) / 2;
      const safeRadius = info.width * 0.4;
      let maximumRadius = 0;

      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const offset = (y * info.width + x) * info.channels;
          const differsFromBackground = background.some(
            (channel, index) =>
              Math.abs((data[offset + index] ?? channel) - channel) > 4,
          );
          if (differsFromBackground) {
            maximumRadius = Math.max(
              maximumRadius,
              Math.hypot(x - center, y - center),
            );
          }
        }
      }

      expect(maximumRadius).toBeLessThanOrEqual(safeRadius);
    },
  );

  it("retains a distinct glyph when rasterized at 32 px", async () => {
    const { data, info } = await sharp(path.resolve("public/favicon-32x32.png"))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const background = [0, 42, 31];
    let foregroundPixels = 0;

    for (let offset = 0; offset < data.length; offset += info.channels) {
      if (
        background.some(
          (channel, index) =>
            Math.abs((data[offset + index] ?? channel) - channel) > 12,
        )
      ) {
        foregroundPixels += 1;
      }
    }

    expect(foregroundPixels / (info.width * info.height)).toBeGreaterThan(0.08);
  });
});

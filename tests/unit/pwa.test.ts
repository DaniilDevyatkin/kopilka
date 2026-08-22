import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { offlineSnapshotSchema } from "@/lib/pwa/offline-snapshot";

describe("PWA foundation", () => {
  it("exposes an installable standalone manifest with regular and maskable icons", () => {
    const value = manifest();

    expect(value).toMatchObject({
      id: "/app",
      name: "Копилка — личные финансы",
      short_name: "Копилка",
      start_url: "/app/home",
      scope: "/",
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      prefer_related_applications: false,
      lang: "ru",
      orientation: "portrait-primary",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icon-192.png",
          sizes: "192x192",
          purpose: "any",
        }),
        expect.objectContaining({
          src: "/icon-maskable-512.png",
          sizes: "512x512",
          purpose: "maskable",
        }),
      ]),
    );
    expect(value.screenshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/pwa/screenshot-home.jpg",
          sizes: "375x812",
          form_factor: "narrow",
        }),
      ]),
    );
  });

  it("keeps the offline snapshot bigint-safe and rejects secret-shaped fields", () => {
    const valid = offlineSnapshotSchema.parse({
      version: 1,
      savedAt: "2026-08-14T08:00:00.000Z",
      currency: "RUB",
      totalCapitalMinor: "125000",
      reservedMinor: "25000",
      freeMinor: "100000",
      accounts: [
        { name: "Основная", type: "DEBIT_CARD", balanceMinor: "125000" },
      ],
      goals: [],
      operations: [],
    });

    expect(valid.totalCapitalMinor).toBe("125000");
    expect(() =>
      offlineSnapshotSchema.parse({
        ...valid,
        sessionToken: "must-never-be-cached",
      }),
    ).toThrow();
    expect(() =>
      offlineSnapshotSchema.parse({
        ...valid,
        totalCapitalMinor: "12.50",
      }),
    ).toThrow();
  });

  it("ships a read-only service worker without a mutation queue", async () => {
    const source = await readFile(path.resolve("public/sw.js"), "utf8");

    expect(source).toContain("/offline.html");
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("CLEAR_PRIVATE_DATA");
    expect(source).toContain("SKIP_WAITING");
    expect(source).toContain("navigationPreload");
    expect(source).toContain('request.destination === "script"');
    expect(source).toContain("return await network");
    expect(source).not.toMatch(
      /backgroundsync|sync\.register|mutation[-_ ]queue/iu,
    );
    expect(source).not.toMatch(/\/api\//u);
  });

  it("ships a real narrow install screenshot and iPhone launch images", async () => {
    const screenshot = await sharp(
      path.resolve("public/pwa/screenshot-home.jpg"),
    ).metadata();
    expect(screenshot).toMatchObject({
      format: "jpeg",
      width: 375,
      height: 812,
    });

    for (const file of [
      "splash-1290x2796.png",
      "splash-1179x2556.png",
      "splash-1170x2532.png",
      "splash-828x1792.png",
      "splash-750x1334.png",
    ]) {
      const metadata = await sharp(path.resolve("public/pwa", file)).metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.width).toBeGreaterThan(700);
      expect(metadata.height).toBeGreaterThan(1300);
    }
  });
});

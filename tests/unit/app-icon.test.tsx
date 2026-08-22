import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  APP_ICON_NAMES,
  AppIcon,
  EXPENSE_ICON_NAMES,
  GOAL_ICON_NAMES,
  INCOME_ICON_NAMES,
  STATUS_ICON_NAMES,
} from "@/components/icons";

const forbiddenIconPackages =
  /lucide|heroicons|font[ -]?awesome|material[ -]?icons|tabler|phosphor|remix[ -]?icons|bootstrap[ -]?icons/iu;

describe("AppIcon catalog", () => {
  it("contains 71 unique, domain-complete icon names", () => {
    expect(APP_ICON_NAMES).toHaveLength(71);
    expect(new Set(APP_ICON_NAMES).size).toBe(APP_ICON_NAMES.length);
    expect(EXPENSE_ICON_NAMES).toHaveLength(13);
    expect(INCOME_ICON_NAMES).toHaveLength(7);
    expect(GOAL_ICON_NAMES).toHaveLength(11);
    expect(STATUS_ICON_NAMES).toEqual([
      "status-active",
      "status-completed",
      "status-archived",
      "status-cancelled",
      "priority-high",
      "priority-medium",
      "priority-low",
    ]);
  });

  it("renders every glyph on the common grid at 16, 20 and 24 pixels", () => {
    for (const name of APP_ICON_NAMES) {
      for (const size of [16, 20, 24] as const) {
        const markup = renderToStaticMarkup(
          <AppIcon name={name} size={size} />,
        );
        expect(markup, `${name} at ${size}px`).toContain('viewBox="0 0 24 24"');
        expect(markup, `${name} at ${size}px`).toContain(`width="${size}"`);
        expect(markup, `${name} at ${size}px`).toContain(
          'stroke="currentColor"',
        );
        expect(markup, `${name} at ${size}px`).toContain('stroke-width="1.8"');
        expect(markup, `${name} at ${size}px`).toContain(
          'stroke-linecap="round"',
        );
        expect(markup, `${name} at ${size}px`).toContain(
          `data-app-icon="${name}"`,
        );
      }
    }
  });

  it("is decorative by default and gains an accessible name through title", () => {
    const decorative = renderToStaticMarkup(<AppIcon name="home" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("<title>");
    expect(decorative).not.toContain('role="img"');

    const semantic = renderToStaticMarkup(
      <AppIcon name="warning" title="Нужна проверка" />,
    );
    expect(semantic).toContain('role="img"');
    expect(semantic).toContain('aria-label="Нужна проверка"');
    expect(semantic).toContain("<title>Нужна проверка</title>");
    expect(semantic).not.toContain("aria-hidden");
  });

  it("keeps all system category icon names from the shared catalog", async () => {
    const catalog = await readFile(
      path.resolve("src/lib/categories/catalog.ts"),
      "utf8",
    );
    const catalogIconNames = [
      ...catalog.matchAll(/"((?:income|expense)-[a-z-]+)"/gu),
    ]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name));

    expect(catalogIconNames).toHaveLength(20);
    for (const iconName of catalogIconNames) {
      expect(APP_ICON_NAMES).toContain(iconName);
    }
  });

  it("does not depend on an icon pack, remote SVG or emoji", async () => {
    const packageJson = await readFile(path.resolve("package.json"), "utf8");
    const sources = await Promise.all(
      [
        "app-icon.tsx",
        "core-glyphs.tsx",
        "finance-category-glyphs.tsx",
        "goal-status-glyphs.tsx",
        "icon-glyphs.tsx",
      ].map((fileName) =>
        readFile(path.resolve("src/components/icons", fileName), "utf8"),
      ),
    );

    expect(packageJson).not.toMatch(forbiddenIconPackages);
    for (const source of sources) {
      expect(source).not.toMatch(forbiddenIconPackages);
      expect(source).not.toMatch(/(?:href|src)=["']https?:\/\//u);
      expect(source).not.toMatch(/from\s+["']https?:\/\//u);
      expect(source).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

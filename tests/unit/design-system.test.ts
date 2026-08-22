import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isThemePreference,
  resolveThemePreference,
} from "@/features/theme/theme";
import { EARLY_THEME_SCRIPT } from "@/features/theme/theme-script";

type Oklch = readonly [lightness: number, chroma: number, hue: number];

function tokenSection(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  if (start < 0 || end < 0)
    throw new Error(`Token section ${from} was not found.`);
  return source.slice(start, end);
}

function parseTokens(source: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const declarations = source.matchAll(
    /--([a-z0-9-]+):\s*(oklch\([^)]+\)|var\(--[a-z0-9-]+\));/giu,
  );
  for (const match of declarations) {
    if (match[1] && match[2]) tokens.set(match[1], match[2]);
  }
  return tokens;
}

function resolveColor(name: string, tokens: Map<string, string>): Oklch {
  const value = tokens.get(name);
  if (!value) throw new Error(`Unknown color token: ${name}`);
  const reference = /^var\(--([a-z0-9-]+)\)$/iu.exec(value);
  if (reference?.[1]) return resolveColor(reference[1], tokens);
  const color = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/u.exec(value);
  if (!color) throw new Error(`Unsupported color value: ${value}`);
  return [Number(color[1]), Number(color[2]), Number(color[3])];
}

function relativeLuminance([lightness, chroma, hue]: Oklch): number {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: Oklch, background: Oklch): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("theme preference", () => {
  it("resolves light, dark and system deterministically", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("unknown")).toBe(false);
  });

  it("applies a validated stored theme before hydration", () => {
    expect(EARLY_THEME_SCRIPT).toContain("localStorage.getItem");
    expect(EARLY_THEME_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(EARLY_THEME_SCRIPT).toContain(
      "document.documentElement.dataset.theme",
    );
  });
});

describe("design token contrast", () => {
  it("meets WCAG AA for primary semantic pairs in light and dark themes", async () => {
    const source = await readFile(
      path.resolve("src/styles/tokens.css"),
      "utf8",
    );
    const primitives = parseTokens(
      tokenSection(
        source,
        "/* === 1. PRIMITIVES === */",
        "/* === 2. LIGHT SEMANTICS === */",
      ),
    );
    const light = new Map([
      ...primitives,
      ...parseTokens(
        tokenSection(
          source,
          "/* === 2. LIGHT SEMANTICS === */",
          "/* === 2. DARK SEMANTICS",
        ),
      ),
    ]);
    const dark = new Map([
      ...primitives,
      ...parseTokens(
        tokenSection(source, "/* === 2. DARK SEMANTICS", "/* No-JS fallback"),
      ),
    ]);

    const textPairs = [
      ["text-primary", "bg"],
      ["text-secondary", "bg"],
      ["text-muted", "surface"],
      ["accent-contrast", "accent"],
      ["positive", "surface"],
      ["negative", "surface"],
      ["warning", "surface"],
    ] as const;
    for (const theme of [light, dark]) {
      for (const [foreground, background] of textPairs) {
        expect(
          contrast(
            resolveColor(foreground, theme),
            resolveColor(background, theme),
          ),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(resolveColor("focus", theme), resolveColor("bg", theme)),
      ).toBeGreaterThanOrEqual(3);
    }

    const accountPairs = [
      ["account-debit-text", "account-debit-from"],
      ["account-debit-text", "account-debit-to"],
      ["account-savings-text", "account-savings-from"],
      ["account-savings-text", "account-savings-to"],
      ["account-credit-text", "account-credit-from"],
      ["account-credit-text", "account-credit-to"],
    ] as const;
    for (const theme of [light, dark]) {
      for (const [foreground, background] of accountPairs) {
        expect(
          contrast(
            resolveColor(foreground, theme),
            resolveColor(background, theme),
          ),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("amount layout safeguards", () => {
  it("keeps an extreme amount intact without widening a narrow viewport", async () => {
    const source = await readFile(
      path.resolve("src/styles/globals.css"),
      "utf8",
    );
    const amountRule = /\.amount,\s*\[data-amount\]\s*\{([\s\S]*?)\}/u.exec(
      source,
    )?.[1];

    expect(amountRule).toBeDefined();
    expect(amountRule).toContain("display: inline-block");
    expect(amountRule).toContain("max-inline-size: 100%");
    expect(amountRule).toContain("overflow-x: auto");
    expect(amountRule).toContain("white-space: nowrap");
  });
});

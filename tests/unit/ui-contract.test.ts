import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const visualKitPattern =
  /@radix-ui|@headlessui|@mui|material-ui|antd|chakra|shadcn|react-bootstrap/iu;

describe("UI primitive architecture contract", () => {
  it("has no direct visual-kit dependency or alert/confirm shortcut", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve("package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const directDependencyNames = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }).join("\n");
    expect(directDependencyNames).not.toMatch(visualKitPattern);

    const uiDirectory = path.resolve("src/components/ui");
    const sourceFiles = (await readdir(uiDirectory)).filter((fileName) =>
      /\.(?:ts|tsx)$/u.test(fileName),
    );
    const sources = await Promise.all(
      sourceFiles.map((fileName) =>
        readFile(path.join(uiDirectory, fileName), "utf8"),
      ),
    );
    for (const source of sources) {
      expect(source).not.toMatch(visualKitPattern);
      expect(source).not.toMatch(/window\.(?:alert|confirm)\s*\(/u);
      expect(source).not.toMatch(/tabIndex=\{?[1-9]/u);
    }
  });

  it("keeps mobile, motion and high-contrast safeguards in the shared styles", async () => {
    const styles = await readFile(
      path.resolve("src/components/ui/ui.module.css"),
      "utf8",
    );
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain("prefers-reduced-motion: no-preference");
    expect(styles).toContain("forced-colors: active");
    expect(styles).toContain("touch-action: manipulation");
    expect(styles).toContain("font-size: 1rem");
  });
});

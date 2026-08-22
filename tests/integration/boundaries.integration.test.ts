import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("server/client module boundaries", () => {
  it("marks infrastructure modules as server-only", async () => {
    const source = await readFile(
      path.resolve("src/server/foundation/get-foundation-status.ts"),
      "utf8",
    );

    expect(source).toContain('import "server-only"');
  });

  it("marks interactive components with use client", async () => {
    const source = await readFile(
      path.resolve("src/components/foundation/client-runtime-check.tsx"),
      "utf8",
    );

    expect(source.startsWith('"use client"')).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

describe("foundation toolchain", () => {
  it("runs strict TypeScript unit tests", () => {
    const stages = ["lint", "typecheck", "test", "build"] as const;

    expect(stages).toHaveLength(4);
    expect(stages).toContain("typecheck");
  });
});

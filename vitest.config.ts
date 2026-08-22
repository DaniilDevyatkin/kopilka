import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    passWithNoTests: false,
    reporters: ["default"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});

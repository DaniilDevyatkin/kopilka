import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://kopilka:kopilka_dev@localhost:5432/kopilka?schema=public",
      SESSION_SECRET:
        process.env.SESSION_SECRET ??
        "kopilka-e2e-session-secret-is-deliberately-long-and-local-only-2026",
      APP_ORIGIN: process.env.APP_ORIGIN ?? "http://127.0.0.1:3000",
    },
  },
});

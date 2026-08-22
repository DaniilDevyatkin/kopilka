import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_ROUTES,
  resolveRouteAccess,
  type RouteArea,
  type RouteSessionState,
} from "@/lib/navigation/routes";

describe("route access matrix", () => {
  const cases: Array<{
    name: string;
    session: RouteSessionState;
    area: RouteArea;
    expected: ReturnType<typeof resolveRouteAccess>;
  }> = [
    {
      name: "allows an anonymous visitor on auth routes",
      session: null,
      area: "public-auth",
      expected: { allowed: true },
    },
    {
      name: "sends an anonymous visitor away from onboarding",
      session: null,
      area: "onboarding",
      expected: { allowed: false, redirectTo: "/login" },
    },
    {
      name: "sends an anonymous visitor away from private routes",
      session: null,
      area: "private",
      expected: { allowed: false, redirectTo: "/login" },
    },
    {
      name: "sends an unfinished user from auth routes to onboarding",
      session: { onboardingCompleted: false },
      area: "public-auth",
      expected: { allowed: false, redirectTo: "/onboarding" },
    },
    {
      name: "allows an unfinished user in onboarding",
      session: { onboardingCompleted: false },
      area: "onboarding",
      expected: { allowed: true },
    },
    {
      name: "keeps an unfinished user out of the private app",
      session: { onboardingCompleted: false },
      area: "private",
      expected: { allowed: false, redirectTo: "/onboarding" },
    },
    {
      name: "sends a ready user from auth routes into the app",
      session: { onboardingCompleted: true },
      area: "public-auth",
      expected: { allowed: false, redirectTo: "/app/home" },
    },
    {
      name: "does not reopen onboarding for a ready user",
      session: { onboardingCompleted: true },
      area: "onboarding",
      expected: { allowed: false, redirectTo: "/app/home" },
    },
    {
      name: "allows a ready user in private routes",
      session: { onboardingCompleted: true },
      area: "private",
      expected: { allowed: true },
    },
  ];

  for (const scenario of cases) {
    it(scenario.name, () => {
      expect(resolveRouteAccess(scenario.session, scenario.area)).toEqual(
        scenario.expected,
      );
    });
  }
});

describe("route catalog", () => {
  it("contains every task route exactly once", () => {
    expect([...new Set(APP_ROUTES)]).toEqual(APP_ROUTES);
    expect(APP_ROUTES).toEqual([
      "/login",
      "/register",
      "/onboarding",
      "/app/home",
      "/app/accounts",
      "/app/accounts/[id]",
      "/app/transactions",
      "/app/goals",
      "/app/goals/new",
      "/app/goals/[id]",
      "/app/analytics",
      "/app/profile",
    ]);
  });

  it("has an App Router page for every catalog entry", async () => {
    await Promise.all(
      APP_ROUTES.map(async (route) => {
        const pagePath = path.resolve(
          "src/app",
          route === "/login" || route === "/register"
            ? `(public-auth)${route}`
            : route.slice(1),
          "page.tsx",
        );
        await expect(access(pagePath)).resolves.toBeUndefined();
      }),
    );
  });

  it("keeps the iPhone shell inside safe areas without disabling zoom", async () => {
    const [layout, shellStyles, globalStyles] = await Promise.all([
      readFile(path.resolve("src/app/layout.tsx"), "utf8"),
      readFile(
        path.resolve("src/components/layout/app-shell.module.css"),
        "utf8",
      ),
      readFile(path.resolve("src/styles/globals.css"), "utf8"),
    ]);

    expect(layout).toContain('viewportFit: "cover"');
    expect(layout).toContain('interactiveWidget: "resizes-content"');
    expect(layout).not.toContain("userScalable: false");
    expect(shellStyles).toContain("env(safe-area-inset-bottom)");
    expect(shellStyles).toContain("env(safe-area-inset-left)");
    expect(shellStyles).toContain("env(safe-area-inset-right)");
    expect(globalStyles).toContain("overflow-x: hidden");
  });
});

import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

import { OnboardingStep, PrismaClient } from "@/generated/prisma/client";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kopilka:kopilka_dev@localhost:5432/kopilka?schema=public";
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  "kopilka-e2e-session-secret-is-deliberately-long-and-local-only-2026";
const BASE_URL = "http://127.0.0.1:3000";
const SESSION_COOKIE_NAME = "kopilka_session";

const PRIVATE_ROUTES = [
  ["/app/home", "Главная"],
  ["/app/accounts", "Мои карты"],
  ["/app/transactions", "История"],
  ["/app/goals", "Хотелки"],
  ["/app/goals/new", "Сформулируйте цель"],
  ["/app/analytics", "Ритм ваших денег"],
  ["/app/profile", "Профиль"],
] as const;

let database: PrismaClient;
let readyUserId: string;
let onboardingUserId: string;
let readyToken: string;
let onboardingToken: string;

async function createRouteUser(onboardingCompleted: boolean) {
  const suffix = randomUUID();
  const passwordHash = await argon2.hash(`route-test-${suffix}`, {
    type: argon2.argon2id,
  });
  const user = await database.user.create({
    data: {
      loginNormalized: `route-${suffix}`,
      loginDisplay: `route-${suffix}`,
      passwordHash,
      displayName: onboardingCompleted ? "Маршрут Готов" : "Маршрут Настройка",
      settings: { create: {} },
      onboardingState: {
        create: onboardingCompleted
          ? {
              currentStep: OnboardingStep.COMPLETED,
              completedAt: new Date(),
            }
          : {},
      },
      notification: { create: {} },
    },
  });
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHmac("sha256", SESSION_SECRET)
    .update(rawToken)
    .digest("hex");
  await database.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { userId: user.id, rawToken };
}

test.beforeAll(async () => {
  database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  const ready = await createRouteUser(true);
  const onboarding = await createRouteUser(false);
  readyUserId = ready.userId;
  readyToken = ready.rawToken;
  onboardingUserId = onboarding.userId;
  onboardingToken = onboarding.rawToken;
});

test.afterAll(async () => {
  await database.user.deleteMany({
    where: { id: { in: [readyUserId, onboardingUserId] } },
  });
  await database.$disconnect();
});

test("protects private and onboarding routes from anonymous visitors", async ({
  page,
}) => {
  for (const [route] of PRIVATE_ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/u);
  }
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login$/u);
  await expect(
    page.getByRole("heading", {
      name: "Продолжите с того места, где остановились",
    }),
  ).toBeVisible();
});

test("keeps public auth routes available to anonymous visitors", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", {
      name: "Продолжите с того места, где остановились",
    }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("region", { name: "Регистрация" })).toBeVisible();
});

test("bootstraps the root route without framework or runtime errors", async ({
  context,
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await context.clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/u);
  await expect(
    page.getByRole("heading", {
      name: "Продолжите с того места, где остановились",
    }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("keeps an unfinished user in onboarding", async ({ context, page }) => {
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: onboardingToken, url: BASE_URL },
  ]);
  await page.goto("/app/home");
  await expect(page).toHaveURL(/\/onboarding$/u);
  await expect(
    page.getByRole("heading", { name: "Создание первого счета" }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding$/u);
});

test("serves every private route to a ready user and redirects auth routes", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: readyToken, url: BASE_URL },
  ]);
  for (const [route, heading] of PRIVATE_ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(
      new RegExp(`${route.replaceAll("/", "\\/")}$`, "u"),
    );
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await page.goto("/login");
  await expect(page).toHaveURL(/\/app\/home$/u);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/app\/home$/u);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/app\/home$/u);
});

test("keeps navigation keyboard-accessible and responsive from 320 to 1440 px", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: readyToken, url: BASE_URL },
  ]);

  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/app/home");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);

    const mobile = page.getByRole("navigation", {
      name: "Основная навигация на телефоне",
    });
    await expect(mobile).toBeVisible();
    const targets = mobile.locator("a, button");
    await expect(targets).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/home");
  await expect(page.locator("html")).toHaveAttribute(
    "data-display-mode",
    /browser|standalone/u,
  );
  const trigger = page.getByRole("button", { name: "Добавить" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Новое действие" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

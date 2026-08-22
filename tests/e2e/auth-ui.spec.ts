import { createHmac, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";

import { OnboardingStep, PrismaClient } from "@/generated/prisma/client";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://kopilka:kopilka_dev@localhost:5432/kopilka?schema=public";
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  "kopilka-e2e-session-secret-is-deliberately-long-and-local-only-2026";
const SESSION_COOKIE_NAME = "kopilka_session";

let database: PrismaClient;
const createdUserIds: string[] = [];

test.beforeAll(() => {
  database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
});

test.afterAll(async () => {
  await database.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await database.$disconnect();
});

test("supports keyboard registration, password change, logout and login", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const suffix = randomUUID();
  const login = `ui-${suffix}`;
  const displayName = "Мария";
  const password = "correct horse battery staple";
  const newPassword = "new correct horse battery staple";

  await page.goto("/register");
  const loginField = page.getByRole("textbox", { name: /^Логин/u });
  await loginField.focus();
  await page.keyboard.type(login);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Имя" })).toBeFocused();
  await page.keyboard.type(displayName);
  await page.keyboard.press("Tab");
  const passwordField = page.getByLabel(/^Пароль/u);
  await expect(passwordField).toBeFocused();
  await page.keyboard.type(password);
  await page.keyboard.press("Tab");
  const visibilityToggle = page
    .getByRole("button", { name: "Показать пароль" })
    .first();
  await expect(visibilityToggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(passwordField).toHaveAttribute("type", "text");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Повторите пароль/u)).toBeFocused();
  await page.keyboard.type(password);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/onboarding$/u, { timeout: 15_000 });
  const user = await database.user.findUniqueOrThrow({
    where: { loginNormalized: login },
    include: { onboardingState: true, sessions: true },
  });
  createdUserIds.push(user.id);
  expect(user.displayName).toBe(displayName);
  expect(user.baseCurrency).toBe("RUB");
  expect(user.passwordHash).toMatch(/^\$argon2id\$/u);
  expect(user.onboardingState?.completedAt).toBeNull();

  const cookie = (await context.cookies()).find(
    (item) => item.name === SESSION_COOKIE_NAME,
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(user.sessions).toHaveLength(1);
  expect(user.sessions[0]?.tokenHash).toBe(
    createHmac("sha256", SESSION_SECRET)
      .update(cookie?.value ?? "")
      .digest("hex"),
  );
  expect(user.sessions[0]?.tokenHash).not.toBe(cookie?.value);

  await database.onboardingState.update({
    where: { userId: user.id },
    data: { currentStep: OnboardingStep.COMPLETED, completedAt: new Date() },
  });
  await page.goto("/app/profile");
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();

  await page.getByLabel(/^Текущий пароль/u).fill(password);
  await page.getByLabel(/^Новый пароль/u).fill(newPassword);
  await page.getByLabel(/^Повторите новый пароль/u).fill(newPassword);
  await page.getByRole("button", { name: "Изменить пароль" }).click();
  await expect(
    page.getByText("Пароль изменён. Остальные сессии завершены."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(page).toHaveURL(/\/login$/u);
  expect(
    (await context.cookies()).find((item) => item.name === SESSION_COOKIE_NAME),
  ).toBeUndefined();

  await page.getByRole("textbox", { name: /^Логин/u }).fill(login);
  await page.getByLabel(/^Пароль/u).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный логин или пароль.")).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("textbox", { name: /^Логин/u }).fill(login);
  await page.getByLabel(/^Пароль/u).fill(newPassword);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app\/home$/u);
});

test("shows client validation and a safe network failure without leaking details", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("textbox", { name: /^Логин/u })).toBeFocused();
  await expect(
    page.getByText("Введите логин: от 3 до 64 символов."),
  ).toBeVisible();

  await page.getByRole("textbox", { name: /^Логин/u }).fill("network-user");
  await page.getByLabel(/^Пароль/u).fill("correct horse battery staple");
  await page.route("**/login", (route) => {
    if (route.request().method() === "POST") void route.abort();
    else void route.continue();
  });
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(
    page.getByText(
      "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
    ),
  ).toBeVisible();
});

test("keeps auth screens usable without horizontal overflow on a narrow iPhone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of ["/login", "/register"]) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
  }
});

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

let database: PrismaClient;
let userId: string;
let rawToken: string;
let accountId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  database = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });
  const suffix = randomUUID();
  const user = await database.user.create({
    data: {
      loginNormalized: `pwa-${suffix}`,
      loginDisplay: `pwa-${suffix}`,
      passwordHash: await argon2.hash(`pwa-${suffix}`, {
        type: argon2.argon2id,
      }),
      displayName: "Анна",
      settings: { create: {} },
      onboardingState: {
        create: {
          currentStep: OnboardingStep.COMPLETED,
          completedAt: new Date(),
        },
      },
      notification: { create: {} },
    },
  });
  userId = user.id;
  const account = await database.account.create({
    data: {
      userId,
      name: "Основная карта",
      type: "DEBIT_CARD",
      currency: "RUB",
      visualTheme: "ocean",
      last4: "4242",
    },
  });
  accountId = account.id;
  rawToken = randomBytes(32).toString("base64url");
  await database.session.create({
    data: {
      userId,
      tokenHash: createHmac("sha256", SESSION_SECRET)
        .update(rawToken)
        .digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
});

test.afterAll(async () => {
  await database.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    await transaction.goalReservationEntry.deleteMany({ where: { userId } });
    await transaction.ledgerEntry.deleteMany({ where: { userId } });
    await transaction.financialOperation.deleteMany({ where: { userId } });
    await transaction.idempotencyKey.deleteMany({ where: { userId } });
    await transaction.goal.deleteMany({ where: { userId } });
    await transaction.account.deleteMany({ where: { userId } });
    await transaction.user.delete({ where: { id: userId } });
  });
  await database.$disconnect();
});

test("installs its PWA shell, saves a secret-free snapshot and serves it offline", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: rawToken, url: BASE_URL },
  ]);
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await page.waitForFunction(() => "serviceWorker" in navigator);
  await page.evaluate(() => navigator.serviceWorker.ready);

  const snapshot = await page.evaluate(async () => {
    const request = indexedDB.open("kopilka-read-only", 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("snapshots", "readonly");
    const get = transaction.objectStore("snapshots").get("financial");
    const value = await new Promise<unknown>((resolve, reject) => {
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    database.close();
    return value;
  });
  expect(JSON.stringify(snapshot)).not.toMatch(
    /token|password|userId|secret/iu,
  );

  await context.setOffline(true);
  await page.goto("/app/home");
  await expect(
    page.getByRole("heading", {
      name: "Сеть пропала, данные остались под рукой",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Копилка показывает последний сохранённый снимок только для чтения.",
    ),
  ).toBeVisible();
  await context.setOffline(false);
});

test("creates a real income and goal through the mobile product UI", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: rawToken, url: BASE_URL },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/home");
  await expect(page.getByRole("heading", { name: "Главная" })).toBeVisible();
  await page.getByRole("link", { name: "Доход", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByTestId("operation-amount").fill("12 345,67");
  await page.getByLabel("Комментарий").fill("Первый доход");
  await page.getByRole("button", { name: "Добавить доход" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await page.goto("/app/transactions?type=income");
  await expect(page.getByLabel("Поиск")).toHaveCount(0);
  await expect(page.getByText("Первый доход")).toBeVisible();
  await expect(page.getByText(/\+12\s?345,67\s?₽/u)).toBeVisible();

  await page.goto("/app/goals/new");
  await page
    .getByRole("textbox", { name: /^Название/u })
    .fill("Ноутбук для работы");
  await page.getByLabel(/Сумма цели/u).fill("150 000");
  await page.getByLabel("Описание").fill("Спокойно накопить без кредита");
  await page.getByRole("button", { name: "Создать хотелку" }).click();
  await expect(page).toHaveURL(/\/app\/goals\/[0-9a-f-]+$/u, {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: "Ноутбук для работы" }),
  ).toBeVisible();
  await page.goto("/app/goals");
  await expect(
    page.getByRole("heading", { name: "Ноутбук для работы" }),
  ).toBeVisible();
});

test("runs transfer, reserve, reconciliation and goal completion end to end", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: rawToken, url: BASE_URL },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/app/accounts/new");
  await page.getByLabel("Название").fill("Резервная карта");
  await page.getByLabel("Начальный баланс").fill("0");
  await page.getByRole("button", { name: "Создать счёт" }).click();
  await expect(page).toHaveURL(/\/app\/accounts$/u, { timeout: 15_000 });

  const secondAccount = await database.account.findFirstOrThrow({
    where: { userId, name: "Резервная карта" },
  });
  const capitalBeforeTransfer =
    (
      await database.ledgerEntry.aggregate({
        where: { userId },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor ?? 0n;

  await page.goto("/app/home");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("button", { name: /Перевод/u }).click();
  await page.getByTestId("transfer-amount").fill("1 000");
  await page.getByLabel("Со счёта").selectOption(accountId);
  await page.getByLabel("На счёт").selectOption(secondAccount.id);
  await page.getByLabel("Комментарий").fill("Между своими картами");
  await page.getByRole("button", { name: "Перевести" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

  const transfer = await database.financialOperation.findFirstOrThrow({
    where: { userId, type: "TRANSFER", note: "Между своими картами" },
    include: { ledgerEntries: true },
  });
  expect(transfer.ledgerEntries).toHaveLength(2);
  expect(
    transfer.ledgerEntries.reduce((sum, entry) => sum + entry.amountMinor, 0n),
  ).toBe(0n);
  expect(
    (
      await database.ledgerEntry.aggregate({
        where: { userId },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor,
  ).toBe(capitalBeforeTransfer);

  const capitalBeforeReserve = capitalBeforeTransfer;
  await page.goto("/app/home");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("button", { name: /Пополнить хотелку/u }).click();
  await page.getByTestId("contribute-amount").fill("500");
  await page.getByLabel("Комментарий").fill("Первый резерв");
  await page.getByRole("button", { name: "Пополнить хотелку" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  expect(
    (
      await database.ledgerEntry.aggregate({
        where: { userId },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor,
  ).toBe(capitalBeforeReserve);
  expect(
    (
      await database.goalReservationEntry.aggregate({
        where: { userId },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor,
  ).toBe(50_000n);

  await page.goto(`/app/accounts/${secondAccount.id}`);
  await page.getByRole("button", { name: "Скорректировать баланс" }).click();
  await page.getByLabel("Фактический баланс").fill("2 000");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  const reconciledBalance = await database.ledgerEntry.aggregate({
    where: { userId, accountId: secondAccount.id },
    _sum: { amountMinor: true },
  });
  expect(reconciledBalance._sum.amountMinor).toBe(200_000n);

  const goal = await database.goal.findFirstOrThrow({
    where: { userId, name: "Ноутбук для работы" },
  });
  await page.goto(`/app/goals/${goal.id}`);
  await page.getByRole("button", { name: "Завершить покупкой" }).click();
  await page.getByLabel("Стоимость покупки").fill("1 000");
  await page.getByRole("button", { name: "Подтвердить покупку" }).click();
  await expect(page.getByText(/Завершена/u)).toBeVisible({
    timeout: 15_000,
  });

  const completed = await database.goal.findUniqueOrThrow({
    where: { id: goal.id },
  });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.actualPurchaseAmountMinor).toBe(100_000n);
  expect(
    (
      await database.goalReservationEntry.aggregate({
        where: { userId, goalId: goal.id },
        _sum: { amountMinor: true },
      })
    )._sum.amountMinor,
  ).toBe(0n);
  expect(
    await database.financialOperation.count({
      where: { userId, goalId: goal.id, type: "GOAL_PURCHASE" },
    }),
  ).toBe(1);
});

test("clears the private offline snapshot on logout", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: SESSION_COOKIE_NAME, value: rawToken, url: BASE_URL },
  ]);
  await page.goto("/app/home");
  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(page).toHaveURL(/\/login$/u);
  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map((database) => database.name),
  );
  expect(names).not.toContain("kopilka-read-only");
});

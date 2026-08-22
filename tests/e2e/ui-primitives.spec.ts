import { expect, test } from "@playwright/test";

test("dialog supports keyboard focus, scroll lock and focus restoration", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/dev/ui");
  const trigger = page.getByRole("button", { name: "Открыть диалог" });
  await trigger.focus();
  await trigger.press("Enter");

  await expect(
    page.getByRole("dialog", { name: "Новая хотелка" }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Например, Поездка в Грузию"),
  ).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Новая хотелка" }),
  ).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveAttribute("data-scroll-lock");
  expect(consoleErrors).toEqual([]);
});

test("desktop dialog stays centered inside the visible viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/dev/ui");
  await page.getByRole("button", { name: "Открыть диалог" }).click();

  const dialog = page.getByRole("dialog", { name: "Новая хотелка" });
  const panel = dialog.locator("div").first();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.y ?? 0).toBeGreaterThan(0);
  expect(
    Math.abs((bounds?.y ?? 0) - (720 - (bounds?.height ?? 0)) / 2),
  ).toBeLessThanOrEqual(2);
});

test("mobile bottom sheet stays in the viewport and avoids horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/ui");
  await page.getByRole("button", { name: "Открыть bottom sheet" }).click();

  const sheet = page.getByRole("dialog", { name: "Добавить операцию" });
  await expect(sheet).toBeVisible();
  const panel = sheet.locator("div").first();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

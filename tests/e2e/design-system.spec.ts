import { expect, test } from "@playwright/test";

test("applies stored dark theme before the design laboratory renders", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("kopilka-theme", "dark"));
  await page.goto("/dev/design-system");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Тихая точность" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Тёмная" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("switches theme accessibly and preserves the preference", async ({
  page,
}) => {
  await page.goto("/dev/design-system");
  const lightButton = page.getByRole("button", { name: "Светлая" });
  await lightButton.focus();
  await expect(lightButton).toBeFocused();
  await lightButton.press("Enter");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("kopilka-theme")))
    .toBe("light");
});

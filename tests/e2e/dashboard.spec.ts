import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home and analytics are usable", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible({
    timeout: 15_000,
  });
  if (testInfo.project.name === "phone")
    await page.getByRole("link", { name: "Analytics", exact: true }).click();
  else
    await page.locator('.app-sidebar a[href="/analytics/leaderboard"]').click();
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Period")).toHaveValue("cm");
  await expect(page.getByLabel("Metric")).toHaveValue("missions");
  if (testInfo.project.name === "phone")
    await expect(page.locator(".data-card").first()).toBeVisible({
      timeout: 15_000,
    });
  else await expect(page.getByRole("table")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});
test("mobile navigation exposes core destinations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone");
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operations" }).click();
  await expect(
    page.getByRole("heading", { name: "Objectives", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
});

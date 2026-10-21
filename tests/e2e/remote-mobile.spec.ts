import { expect, test } from "@playwright/test";

test("mobile remote has touch-sized panel controls and assist access without dashboard navigation", async ({
  page,
}, testInfo) => {
  let joins = 0;
  await page.route("**/api/remote-screen/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/devices")) {
      return route.fulfill({
        json: {
          devices: [
            {
              id: "a".repeat(32),
              name: "Tablet Elite",
              online: true,
              owner: true,
              grants: {},
              can_control: true,
              status: { commander: "Test Commander", control_enabled: true },
            },
          ],
        },
      });
    }
    joins++;
    return route.fulfill({
      status: 503,
      json: { error: { message: "Test: media connection unavailable" } },
    });
  });
  await page.goto("/remote");
  await expect(
    page.getByRole("heading", { name: "ANKe Remote", exact: true }),
  ).toBeVisible();
  expect(joins).toBe(0);
  await expect(
    page.getByRole("button", { name: "Pair an ANKe client" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "media connection unavailable" }),
  ).toBeVisible();
  for (const name of [
    "Navigation",
    "Kommunikation",
    "Rollenpanel",
    "Systeme",
    "↑",
    "↓",
    "←",
    "→",
    "Auswählen",
    "Zurück",
    "Tab zurück",
    "Tab weiter",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  }
  await expect(
    page.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Manage access" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("remote-panels.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Flugsteuerung", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Schub 0 %", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assistenten", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close screen" }).click();
  await expect(
    page.getByRole("button", { name: "Verbinden", exact: true }),
  ).toBeVisible();
});

test("offline clients cannot be connected from mobile", async ({ page }) => {
  await page.route("**/api/remote-screen/devices", (route) =>
    route.fulfill({
      json: {
        devices: [
          {
            id: "b".repeat(32),
            name: "Offline Elite",
            online: false,
            owner: true,
            grants: {},
            can_control: true,
            status: {},
          },
        ],
      },
    }),
  );
  await page.goto("/remote");
  await expect(
    page.getByRole("button", { name: "Verbinden", exact: true }),
  ).toBeDisabled();
});

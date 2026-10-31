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
              status: { commander: "Test Commander", assist: "FSD Route Assist", ap_log: "Jump complete", ap_status: "Aligning", jump_count: 3, total_jumps: 12, control_enabled: true },
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
  ).toHaveCount(0);
  await expect(page.getByText("Tablet & mobile control", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Livebild, Panels und Assistenten – direkt per Touch.", { exact: true })).toHaveCount(0);
  expect(joins).toBe(0);
  await expect(
    page.getByRole("button", { name: "Pair an ANKe client" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Verbinden", exact: true }).click();
  const overview = page.getByRole("definition");
  await expect(overview.filter({ hasText: "Test Commander" })).toBeVisible();
  await expect(overview.filter({ hasText: "FSD Route Assist" })).toBeVisible();
  await expect(overview.filter({ hasText: "3 von 12" })).toBeVisible();
  await expect(overview.filter({ hasText: "Jump complete" })).toBeVisible();
  await expect(overview.filter({ hasText: "Aligning" })).toBeVisible();
  const summary = page.locator('dl[aria-label="Autopilot overview"]');
  const video = page.locator(".remote-video");
  const summaryBox = await summary.boundingBox();
  const videoBox = await video.boundingBox();
  expect(summaryBox!.y + summaryBox!.height).toBeLessThanOrEqual(videoBox!.y);
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

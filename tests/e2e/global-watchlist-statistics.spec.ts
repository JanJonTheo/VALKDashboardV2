import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("global statistics cover the entire list and fit the viewport", async ({
  page,
}) => {
  await page.route("**/api/preferences/**", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/system-watchlist**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("statistics") === "true")
      return route.fulfill({
        json: {
          statistics: {
            systemCount: 108,
            availableCount: 108,
            totalPopulation: 108000,
            largestPopulationSystem: {
              name: "Beyond first page",
              population: 5000,
            },
            security: [{ label: "High", count: 108 }],
            allegiance: [{ label: "Empire", count: 108 }],
            powerplay: [{ label: "No power assigned", count: 108 }],
            facilities: [{ label: "Coriolis", count: 29 }],
            facilityCachedSystems: 29,
          },
        },
      });
    return route.fulfill({
      json: {
        watchlist: [],
        data: [],
        pagination: { page: 1, page_size: 25, total: 108 },
        filter_options: {},
      },
    });
  });
  await page.goto("/intelligence/watchlist");
  await page
    .getByRole("tab", { name: "Global watchlist", exact: true })
    .click();
  await page.getByRole("button", { name: "Statistics", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Watchlist statistics" });
  await expect(dialog.getByText("Beyond first page")).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include(".watch-statistics-dialog")
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Close statistics" }).click();
  await expect(dialog).not.toBeVisible();
});

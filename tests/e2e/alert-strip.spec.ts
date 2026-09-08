import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("compact alerts show the correct pair and highlight its details without growing", async ({
  page,
}, testInfo) => {
  const system = "39 Tauri",
    principal = "East India Company",
    rival = "39 Tauri Major Exchange",
    other = "Other faction";
  const alarm = {
    id: "one",
    system_name: system,
    owner_scope: "tenant",
    severity: "warning",
    title: `Faction closes to a 2 pp gap · ${system}`,
    rule_name: "Faction closes to a 2 pp gap",
    message: `Faction influence moved within an absolute 2.00 percentage-point gap of ${principal}: ${rival} (1.87 pp).`,
    fired_at: "2026-09-08T18:37:55Z",
    fired_ticktime: "2026-09-08T11:07:08Z",
    facts: {
      tenant_faction: principal,
      threshold_pp: 2,
      entered_factions: [{ faction: rival, gap_pp: 1.87 }],
    },
    discord: {
      configured: true,
      status: null,
      last_sent_at: null,
      error: null,
    },
  };
  const requests: string[][] = [];
  await page.route("**/api/preferences/**", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/bgs-ai**", (route) =>
    route.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      json: {
        unread_count: 2,
        data: [
          alarm,
          {
            ...alarm,
            id: "two",
            facts: {
              tenant_faction: principal,
              threshold_pp: 2,
              entered_factions: [{ faction: other, gap_pp: 0.5 }],
            },
          },
        ],
      },
    }),
  );
  await page.route("**/api/system-watchlist/detail**", (route) => {
    if (route.request().method() === "POST")
      requests.push(route.request().postDataJSON().systems);
    return route.fulfill({
      json: {
        data: [
          {
            requested_system: system,
            available: true,
            system_info: {
              system_name: system,
              controlling_faction: principal,
              population: 1000000,
              government: "Corporate",
              allegiance: "Independent",
              updated_at: "2026-09-08T12:00:00Z",
            },
            factions: [principal, rival, other].map((name, i) => ({
              name,
              influence: [0.4, 0.35, 0.25][i],
              government: "Corporate",
              allegiance: "Independent",
              active_states: [{ state: "Boom" }],
              pending_states: [{ state: "Expansion" }],
            })),
            history: [
              {
                ticktime: "2026-09-05T12:00:00Z",
                factions: [principal, rival, other].map((name, i) => ({
                  name,
                  influence: [0.43, 0.34, 0.23][i],
                })),
              },
            ],
            conflicts: [],
          },
        ],
      },
    });
  });
  await page.route("**/api/system-watchlist/stations**", (route) =>
    route.fulfill({
      json: {
        data: { system, stations: [], source: "Spansh", source_url: "" },
      },
    }),
  );
  await page.goto("/intelligence/alerts");
  const card = page.locator(".bgs-alert-card").first();
  await expect(card.getByText("Gap 1.87 pp", { exact: true })).toBeVisible();
  await expect(card.locator(".alert-faction-card")).toHaveCount(2);
  await expect(
    card.getByLabel(`${rival}, current influence 35.00 percent`),
  ).toBeVisible();
  await expect(
    card.locator(".alert-factions").getByText(other, { exact: true }),
  ).toHaveCount(0);
  expect(
    await card.evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(testInfo.project.name === "phone" ? 396 : 245);
  expect(
    Math.abs(
      (await card.evaluate((el) => el.getBoundingClientRect().height)) -
        (testInfo.project.name === "phone" ? 394.4375 : 242.6875),
    ),
  ).toBeLessThan(2);
  expect(requests.flat().filter((name) => name === system)).toHaveLength(1);
  const factsFit = await card
    .locator(".alert-current-system")
    .evaluate((el) => {
      const bounds = el.getBoundingClientRect();
      return (
        [...el.querySelectorAll(".watch-system-facts > *")].every((child) => {
          const rect = child.getBoundingClientRect();
          return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
        }) && el.scrollHeight <= el.clientHeight
      );
    });
  expect(
    factsFit,
    "Controller and system chips fit vertically without clipping",
  ).toBe(true);
  await card.getByText("Gap 1.87 pp", { exact: true }).click();
  await expect(card.getByText(alarm.message, { exact: true })).toBeVisible();
  await card.locator("summary").press("Escape");
  await page.screenshot({
    path: testInfo.outputPath("compact-alert.png"),
    fullPage: true,
  });
  for (const [index, second] of [
    [0, rival],
    [1, other],
  ] as const) {
    await page
      .locator(".bgs-alert-card")
      .nth(index)
      .getByRole("button", { name: system, exact: true })
      .click();
    const details = page.getByRole("dialog", {
      name: "Record detail",
      exact: true,
    });
    await expect(details.locator(".alert-affected-faction")).toHaveCount(2);
    await expect(
      details.locator(".alert-affected-faction").filter({ hasText: principal }),
    ).toHaveCount(1);
    await expect(
      details.locator(".alert-affected-faction").filter({ hasText: second }),
    ).toHaveCount(1);
    await expect(details.locator(".watch-history-faction-row")).toHaveCount(3);
    await details
      .getByText("Influence history", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`highlighted-details-${index}.png`),
    });
    await details.getByRole("button", { name: "Close details" }).click();
  }
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
});

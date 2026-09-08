import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("alert system details, link menu and individual Discord resend", async ({
  page,
}, testInfo) => {
  const system = "Preae Aihm DN-I c23-44";
  let sent = false;
  const requests: string[] = [];
  await page.route("**/api/preferences/**", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/bgs-alerts**", async (route) => {
    if (route.request().method() === "POST") {
      requests.push(route.request().postDataJSON().request_id);
      sent = true;
      return route.fulfill({
        status: 202,
        json: { data: { status: "pending" } },
      });
    }
    return route.fulfill({
      json: {
        unread_count: 1,
        data: [
          {
            id: "alarm",
            system_name: system,
            rule_name: "Faction gap",
            title: `Faction gap · ${system}`,
            message: "Rival closes to a 2 pp gap.",
            severity: "warning",
            owner_scope: "tenant",
            fired_at: "2026-09-08T18:00:00Z",
            fired_ticktime: "2026-09-08T11:00:00Z",
            resolved_at: null,
            read_at: null,
            acknowledged_at: null,
            discord: {
              configured: true,
              status: sent ? "delivered" : null,
              last_sent_at: sent ? "2026-09-08T18:01:00Z" : null,
              error: null,
            },
          },
        ],
      },
    });
  });
  await page.route("**/api/system-watchlist/detail?**", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            requested_system: system,
            available: true,
            system_info: {
              system_name: system,
              controlling_faction: "Valkyrie",
              population: 1000,
            },
            factions: [{ name: "Valkyrie", influence: 0.4 }],
            history: [
              {
                ticktime: "2026-09-05T12:00:00Z",
                factions: [{ name: "Valkyrie", influence: 0.45 }],
              },
              {
                ticktime: "2026-09-08T12:00:00Z",
                factions: [{ name: "Valkyrie", influence: 0.4 }],
              },
            ],
          },
        ],
      },
    }),
  );
  await page.route("**/api/system-watchlist/stations?**", (route) =>
    route.fulfill({
      json: {
        data: { system, stations: [], source: "Spansh", source_url: "" },
      },
    }),
  );
  await page.goto("/intelligence/alerts");
  await page.route("**/api/system-watchlist/sysmap?**", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } }),
  );
  const name = page.getByRole("button", { name: system, exact: true });
  await expect(name).toBeVisible();
  await name.click();
  const details = page.getByRole("dialog", {
    name: "Record detail",
    exact: true,
  });
  await expect(
    details.getByText("Influence history", { exact: true }),
  ).toBeVisible();
  await expect(details.getByText("40.00%", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("alert-record-details.png"),
    fullPage: true,
  });
  await details.getByRole("button", { name: "Close details" }).click();
  await page
    .getByRole("button", { name: `External links for ${system}` })
    .click();
  for (const label of [
    "Raven Colonial",
    "Inara",
    "Spansh",
    "EDGIS",
    "Record Details",
  ])
    await expect(
      page.getByRole("menuitem", { name: label, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Record Details", exact: true })
    .click();
  await expect(
    details.getByText("Influence history", { exact: true }),
  ).toBeVisible();
  await details.getByRole("button", { name: "Close details" }).click();
  await page
    .getByRole("button", { name: "Send to Discord", exact: true })
    .click();
  await expect(page.getByText(/Last sent:/)).toBeVisible();
  await page
    .getByRole("button", { name: "Send to Discord again", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  await page
    .getByRole("button", { name: `External links for ${system}` })
    .click();
  await page.getByRole("menuitem", { name: "EDGIS", exact: true }).click();
  const map = page.getByRole("dialog", { name: "EDGIS system map" });
  await expect(map).toBeVisible();
  await map.getByRole("button", { name: "Close EDGIS system map" }).click();
  expect(requests[0]).not.toBe(requests[1]);
  await expect(page.getByRole("button", { name: "Mark read" })).toBeVisible();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("alert-actions.png"),
    fullPage: true,
  });
});

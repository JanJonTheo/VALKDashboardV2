import { expect, test } from "@playwright/test";

test("admin resolves and deletes a shared alert", async ({
  page,
}, testInfo) => {
  let resolved = false;
  let deleted = false;
  await page.route("**/api/preferences/**", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/bgs-alerts**", (route) => {
    const request = route.request();
    if (request.method() === "DELETE") {
      deleted = true;
      return route.fulfill({ json: { ok: true } });
    }
    if (request.method() === "POST" && request.url().endsWith("/resolve")) {
      resolved = true;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        unread_count: deleted ? 0 : 1,
        data: deleted
          ? []
          : [
              {
                id: "housekeeping",
                title: "Influence loss",
                system_name: "Sol",
                rule_name: "Guard",
                owner_scope: "tenant",
                severity: "warning",
                can_manage: true,
                discord: {
                  configured: true,
                  status: "delivered",
                  last_sent_at: "2026-09-11T00:01:00Z",
                  error: null,
                },
                fired_at: "2026-09-11T00:00:00Z",
                facts: {},
                resolved_at: resolved ? "2026-09-11T01:00:00Z" : null,
              },
            ],
      },
    });
  });
  await page.goto("/intelligence/alerts");
  await expect(
    page.getByText("Resolved alerts are automatically deleted after 10 days.", {
      exact: false,
    }),
  ).toBeVisible();
  const headerActions = page.locator(".bgs-alert-header-actions");
  const viewsButton = headerActions.getByRole("button", {
    name: "Views",
    exact: true,
  });
  const refreshButton = headerActions.getByRole("button", {
    name: "Refresh",
    exact: true,
  });
  await expect(viewsButton).toBeVisible();
  const viewsBounds = (await viewsButton.boundingBox())!;
  const refreshBounds = (await refreshButton.boundingBox())!;
  expect(Math.abs(viewsBounds.y - refreshBounds.y)).toBeLessThan(1);
  expect(viewsBounds.x + viewsBounds.width).toBeLessThanOrEqual(
    refreshBounds.x,
  );
  const card = page.locator(".bgs-alert-card");
  await expect(card.locator("footer button")).toHaveCount(4);
  await expect(card.getByRole("button", { name: "Acknowledge" })).toHaveCount(
    0,
  );
  const layout = await card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footer = element.querySelector("footer")!;
    const actions = footer.querySelector(":scope > div")!;
    const buttons = Array.from(footer.querySelectorAll("button")).map(
      (button) => button.getBoundingClientRect(),
    );
    return {
      heights: buttons.map((button) => button.height),
      contained: buttons.every(
        (button) =>
          button.top >= bounds.top &&
          button.bottom <= bounds.bottom &&
          button.left >= bounds.left &&
          button.right <= bounds.right,
      ),
      noScroll:
        actions.scrollHeight <= actions.clientHeight &&
        actions.scrollWidth <= actions.clientWidth,
    };
  });
  expect(layout.contained).toBe(true);
  expect(layout.noScroll).toBe(true);
  expect(
    Math.max(...layout.heights) - Math.min(...layout.heights),
  ).toBeLessThan(1);
  await page.screenshot({
    path: testInfo.outputPath("alert-actions.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Mark resolved", exact: true })
    .click();
  await expect(page.locator(".resolved-pill")).toHaveText("Resolved");
  await expect(
    page.getByRole("button", { name: "Mark resolved", exact: true }),
  ).toHaveCount(0);
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("everyone in this tenant");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No matching alerts")).toBeVisible();
  expect(deleted).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

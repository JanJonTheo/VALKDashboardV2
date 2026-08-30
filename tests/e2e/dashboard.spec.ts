import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home and analytics are usable", async ({ page }, testInfo) => {
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        unread_count: 2,
        data: [
          {
            id: "home-alert-1",
            rule_id: "rule-1",
            rule_name: "Controller guard",
            owner_scope: "tenant",
            system_name: "HIP 91987",
            severity: "critical",
            title: "Controller influence critical",
            message:
              "The controlling faction is below the configured threshold.",
            facts: {},
            event_key: "controller-guard",
            fired_ticktime: "2026-08-29T12:00:00Z",
            fired_at: "2026-08-29T12:05:00Z",
            resolved_at: null,
            read_at: null,
            acknowledged_at: null,
          },
          {
            id: "home-alert-2",
            rule_id: "rule-2",
            rule_name: "Competitor movement",
            owner_scope: "personal",
            system_name: "Pollux",
            severity: "warning",
            title: "Competitor gained influence",
            message: "A monitored competitor gained influence after the tick.",
            facts: {},
            event_key: "competitor-movement",
            fired_ticktime: "2026-08-29T12:00:00Z",
            fired_at: "2026-08-29T12:06:00Z",
            resolved_at: null,
            read_at: null,
            acknowledged_at: null,
          },
        ],
      }),
    }),
  );
  const homeAlertsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/bgs-alerts" &&
      url.searchParams.get("status") === "active"
    );
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible({
    timeout: 15_000,
  });
  const homeMetrics = page.locator(".home-metrics");
  for (const label of [
    "Active commanders",
    "Influence contribution",
    "Bounty vouchers",
    "Exploration sales",
    "Combat bonds",
    "Trade volume",
    "Open objectives",
  ]) {
    await expect(homeMetrics.getByText(label, { exact: true })).toBeVisible();
  }
  const activityLegend = page.getByLabel("Activity metrics");
  for (const label of [
    "Influence contribution",
    "Bounty vouchers",
    "Exploration sales",
    "Combat bonds",
    "Trade volume",
  ]) {
    await expect(
      activityLegend.getByText(label, { exact: true }),
    ).toBeVisible();
  }
  await expect(
    page
      .getByTestId("home-activity-chart")
      .getByRole("img", { name: /Grouped bars showing/ }),
  ).toBeVisible();
  await expect(page.getByText("Last tick", { exact: true })).toBeVisible();
  await expect(page.getByText("Est. next tick", { exact: true })).toBeVisible();
  await expect(page.getByText("DATA SNAPSHOT", { exact: true })).toBeVisible();
  await expect(page.getByText("TICK TIMER", { exact: true })).toBeVisible();
  await expect(page.getByText("BGS ALERTS", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current warnings" }),
  ).toBeVisible();
  const currentAlerts = page.getByRole("list", {
    name: "Current BGS alerts",
  });
  await expect(currentAlerts.getByRole("listitem")).toHaveCount(2);
  await expect(currentAlerts).toContainText("Controller influence critical");
  await expect(currentAlerts).toContainText("Competitor gained influence");
  const currentAlertsUrl = new URL((await homeAlertsRequest).url());
  expect(currentAlertsUrl.searchParams.get("scope")).toBe("all");
  expect(currentAlertsUrl.searchParams.get("severity")).toBe("all");
  expect(currentAlertsUrl.searchParams.get("limit")).toBe("200");
  await expect(
    page.getByRole("timer", { name: /Time to next tick/ }),
  ).toBeVisible();
  const tickCardHeights = await page
    .locator(".tick-card-stack > .tick-card")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
  expect(tickCardHeights).toHaveLength(2);
  expect(Math.abs(tickCardHeights[0] - tickCardHeights[1])).toBeLessThan(1);
  const commandLayout = await page.locator(".home-grid").evaluate((grid) => {
    const primary = grid.querySelector<HTMLElement>(".home-primary-column");
    const secondary = grid.querySelector<HTMLElement>(".home-secondary-column");
    const heights = (column: HTMLElement | null) =>
      column
        ? Array.from(column.children).map(
            (element) => element.getBoundingClientRect().height,
          )
        : [];
    return {
      primaryCards: heights(primary),
      secondaryCards: heights(secondary),
      primaryTotal: primary?.getBoundingClientRect().height ?? 0,
      secondaryTotal: secondary?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(commandLayout.primaryCards).toHaveLength(3);
  expect(commandLayout.secondaryCards).toHaveLength(3);
  expect(
    Math.max(...commandLayout.primaryCards) -
      Math.min(...commandLayout.primaryCards),
  ).toBeLessThan(1);
  expect(
    Math.abs(commandLayout.primaryTotal - commandLayout.secondaryTotal),
  ).toBeLessThan(1);
  const activityLayout = await page
    .locator(".home-activity")
    .evaluate((card) => {
      const context = card.querySelector<HTMLElement>(".home-chart-context");
      const chart = card.querySelector<HTMLElement>(".home-chart-canvas");
      if (!context || !chart) return null;
      const cardBounds = card.getBoundingClientRect();
      const contextBounds = context.getBoundingClientRect();
      const chartBounds = chart.getBoundingClientRect();
      return {
        bottomGap: cardBounds.bottom - contextBounds.bottom,
        chartHeight: chartBounds.height,
      };
    });
  expect(activityLayout).not.toBeNull();
  expect(activityLayout?.bottomGap).toBeLessThan(35);
  if (testInfo.project.name !== "phone")
    expect(activityLayout?.chartHeight).toBeGreaterThan(180);

  const expectedColumns =
    testInfo.project.name === "desktop"
      ? 7
      : testInfo.project.name === "tablet"
        ? 4
        : 1;
  expect(
    await homeMetrics.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(expectedColumns);
  if (testInfo.project.name === "phone") {
    const chartScroller = page.locator(".home-chart-scroll");
    expect(
      await chartScroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
  }

  const homeResults = await new AxeBuilder({ page }).analyze();
  expect(
    homeResults.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);

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

test("home activity tooltip exposes exact values and percentages", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.clock.setFixedTime(new Date("2026-08-29T11:18:02Z"));
  await page.route("**/api/bff/home", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        metrics: {
          activeCommanders: 1,
          influence: 25,
          bountyVouchers: 1000,
          explorationSales: 2000,
          combatBonds: 3000,
          tradeVolume: 4000,
          openObjectives: 0,
        },
        activity: [
          {
            cmdr: "Test Pilot",
            influence: 25,
            bountyVouchers: 1000,
            explorationSales: 2000,
            combatBonds: 3000,
            tradeVolume: 4000,
          },
        ],
        objectives: [],
        generated_at: "2026-08-29T15:47:00Z",
        last_tick: "2026-08-29T10:18:02Z",
        tenant: "VALK Development",
      }),
    }),
  );

  await page.goto("/");
  const canvas = page.getByTestId("home-activity-chart").locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 100);

  const tooltip = page.locator(".home-activity-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Test Pilot");
  await expect(tooltip).toContainText("1,000 Cr");
  await expect(tooltip).toContainText("100.0%");
  await expect(page.getByLabel("Galaxy tick schedule")).toContainText(
    "29 Aug 2026, 10:18 UTC",
  );
  await expect(page.getByLabel("Galaxy tick schedule")).toContainText(
    "30 Aug 2026, 10:18 UTC",
  );
  await expect(
    page.getByRole("timer", { name: "Time to next tick: 23:00" }),
  ).toContainText("23:00");
  const refreshFontSize = await page
    .locator(".tick-card-stack > .tick-card:first-child .tick-time strong")
    .evaluate((element) => getComputedStyle(element).fontSize);
  const countdownFontSize = await page
    .locator(".tick-countdown strong")
    .evaluate((element) => getComputedStyle(element).fontSize);
  expect(countdownFontSize).toBe(refreshFontSize);
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

test("BGS alert centre exposes persistent alert state", async ({ page }) => {
  await page.route("**/api/bgs-alerts**", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        unread_count: 1,
        data: [
          {
            id: "alert-1",
            rule_id: "rule-1",
            rule_name: "Controller guard",
            owner_scope: "tenant",
            system_name: "HIP 91987",
            severity: "critical",
            title: "Controller guard · HIP 91987",
            message:
              "The controlling faction is below the configured threshold.",
            facts: {},
            fired_ticktime: "2026-08-29T12:00:00Z",
            fired_at: "2026-08-29T12:05:00Z",
            resolved_at: null,
            read_at: null,
            acknowledged_at: null,
          },
        ],
      }),
    });
  });
  await page.goto("/intelligence/alerts");
  await expect(
    page.getByRole("heading", { name: "Alert centre" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Controller guard · HIP 91987" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge" }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

test("watchlist creates a global personal BGS rule", async ({ page }) => {
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unread_count: 0, data: [] }),
    }),
  );
  await page.route("**/api/preferences/bgs-system-watchlist-sort", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    }),
  );
  await page.route("**/api/system-watchlist/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        watchlist: [
          {
            system: "HIP 91987",
            sector: "VELA",
            projectName: "Velaris",
            favorite: false,
          },
        ],
        data: [
          {
            requested_system: "HIP 91987",
            available: true,
            system_info: {
              system_name: "HIP 91987",
              controlling_faction: "Test Controller",
              population: 1000,
            },
            factions: [{ name: "Test Controller", influence: 0.4 }],
            history: [],
            conflicts: [],
            powerplays: [],
          },
        ],
        facility_statistics: {
          types: { dodec: 0, orbis: 0, ocellus: 0, coriolis: 0 },
          cached_systems: 0,
          requested_systems: 1,
        },
        generated_at: "2026-08-29T12:00:00Z",
      }),
    }),
  );
  let submitted: unknown;
  await page.route("**/api/bgs-rules", async (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "rule-1",
            ...(submitted as object),
            owner_user_id: "demo-user",
            created_at: "2026-08-29T12:00:00Z",
            updated_at: "2026-08-29T12:00:00Z",
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.goto("/intelligence/watchlist");
  await expect(
    page.getByRole("heading", { name: "System watchlist" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rules" }).click();
  const ruleSheet = page.getByRole("dialog", { name: "BGS alert rules" });
  await expect(ruleSheet).toBeVisible();
  await ruleSheet.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const sheetLayout = await ruleSheet.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(sheetLayout.scrollWidth).toBeLessThanOrEqual(
    sheetLayout.clientWidth + 1,
  );
  expect(sheetLayout.left).toBeGreaterThanOrEqual(-1);
  expect(sheetLayout.right).toBeLessThanOrEqual(sheetLayout.viewportWidth + 1);
  expect(
    Math.abs(sheetLayout.height - sheetLayout.viewportHeight),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Create rule" }).click();
  await expect.poll(() => submitted).not.toBeUndefined();
  expect(submitted).toMatchObject({
    owner_scope: "personal",
    target_scope: "watchlist_all",
    threshold_pp: 10,
  });
});

test("watchlist applies the tenant-faction catalog package", async ({
  page,
}) => {
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unread_count: 0, data: [] }),
    }),
  );
  await page.route("**/api/preferences/bgs-system-watchlist-sort", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    }),
  );
  await page.route("**/api/system-watchlist/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        watchlist: [],
        data: [],
        generated_at: "2026-08-30T00:00:00Z",
      }),
    }),
  );
  await page.route("**/api/bgs-rules", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );
  let applied: unknown;
  await page.route("**/api/bgs-rule-templates**", async (route) => {
    if (route.request().url().endsWith("/apply")) {
      applied = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "package-1",
            template_id: "early-warning",
            template_version: 1,
            owner_scope: "personal",
            owner_user_id: "demo-user",
            watchlist_scope: "personal",
            personal_discord: true,
            tenant_discord: false,
            rules: [],
            created_at: "2026-08-30T00:00:00Z",
            updated_at: "2026-08-30T00:00:00Z",
          },
          already_applied: false,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "early-warning",
            name: "Tenant Faction Early Warning",
            description: "Four tenant-faction transition rules.",
            version: 1,
            default_discord: true,
            archived: false,
            archived_at: null,
            created_at: "2026-08-30T00:00:00Z",
            updated_at: "2026-08-30T00:00:00Z",
            packages: [],
            items: [
              {
                key: "loss",
                name: "Tenant faction influence loss",
                condition: { type: "tenant_faction_loss", threshold_pp: 3 },
                severity: "warning",
              },
              {
                key: "conflict",
                name: "Tenant faction conflict",
                condition: {
                  type: "tenant_faction_new_conflict",
                  conflict_types: ["election", "war"],
                },
                severity: "warning",
              },
              {
                key: "below",
                name: "Tenant faction below threshold",
                condition: { type: "tenant_faction_below", threshold_pp: 5 },
                severity: "critical",
              },
              {
                key: "gap",
                name: "Faction closes the gap",
                condition: { type: "tenant_faction_gap", threshold_pp: 2 },
                severity: "warning",
              },
            ],
          },
        ],
        discord_availability: { personal: true, global: false },
        can_manage_templates: false,
        can_apply_global: false,
      }),
    });
  });

  await page.goto("/intelligence/watchlist");
  await page.getByRole("button", { name: "Rules" }).click();
  await page.getByRole("button", { name: "Catalog" }).click();
  await expect(page.getByText("Tenant Faction Early Warning")).toBeVisible();
  await page.getByRole("button", { name: "Apply template" }).click();
  await expect(
    page.getByLabel("Send to the personal Discord webhook"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Apply package" }).click();
  await expect
    .poll(() => applied)
    .toEqual({
      watchlist_scope: "personal",
      discord: true,
    });
});

test("protected watchlist applies early warning to one faction", async ({
  page,
}) => {
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ unread_count: 0, data: [] }),
    }),
  );
  await page.route("**/api/preferences/bgs-system-watchlist-sort", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    }),
  );
  await page.route("**/api/system-watchlist/data", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ watchlist: [], data: [] }),
    }),
  );
  await page.route("**/api/system-watchlist/protected**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            requested_system: "Aegis Prime",
            available: true,
            system_info: {
              system_name: "Aegis Prime",
              controlling_faction: "Aegis Shield",
              population: 1000,
            },
            factions: [{ name: "Aegis Shield", influence: 0.4 }],
            history: [],
            conflicts: [],
            powerplays: [],
          },
        ],
        generated_at: "2026-08-30T00:00:00Z",
        pagination: { page: 1, page_size: 25, total: 1 },
        filter_options: { allegiances: [], governments: [] },
        protected_factions: [
          {
            id: 9,
            name: "Aegis Shield",
            description: "Protected ally",
            webhook_configured: true,
          },
        ],
        selected_protected_faction_id: null,
      }),
    }),
  );
  await page.route("**/api/bgs-rules", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );

  let applied: unknown;
  await page.route("**/api/bgs-rule-templates**", async (route) => {
    if (route.request().url().endsWith("/apply")) {
      applied = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "protected-package-9",
            template_id: "protected-early-warning",
            template_version: 1,
            owner_scope: "tenant",
            owner_user_id: null,
            watchlist_scope: "protected",
            protected_faction_id: 9,
            protected_faction: {
              id: 9,
              name: "Aegis Shield",
              description: "Protected ally",
              active: true,
              webhook_configured: true,
            },
            personal_discord: false,
            tenant_discord: true,
            rules: [],
            created_at: "2026-08-30T00:00:00Z",
            updated_at: "2026-08-30T00:00:00Z",
          },
          already_applied: false,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "protected-early-warning",
            name: "Protected Faction Early Warning",
            description: "Four protected-faction transition rules.",
            version: 1,
            target_kind: "protected_faction",
            default_discord: true,
            archived: false,
            archived_at: null,
            created_at: "2026-08-30T00:00:00Z",
            updated_at: "2026-08-30T00:00:00Z",
            packages: [],
            items: [
              {
                key: "loss",
                name: "Protected faction influence loss",
                condition: { type: "tenant_faction_loss", threshold_pp: 3 },
                severity: "warning",
              },
              {
                key: "conflict",
                name: "Protected faction conflict",
                condition: {
                  type: "tenant_faction_new_conflict",
                  conflict_types: ["election", "war"],
                },
                severity: "warning",
              },
              {
                key: "below",
                name: "Protected faction below threshold",
                condition: { type: "tenant_faction_below", threshold_pp: 5 },
                severity: "critical",
              },
              {
                key: "gap",
                name: "Protected faction closes the gap",
                condition: { type: "tenant_faction_gap", threshold_pp: 2 },
                severity: "warning",
              },
            ],
          },
        ],
        discord_availability: { personal: false, global: false },
        can_manage_templates: false,
        can_apply_global: true,
        can_apply_protected: true,
        protected_factions: [
          {
            id: 9,
            name: "Aegis Shield",
            description: "Protected ally",
            active: true,
            webhook_configured: true,
          },
        ],
      }),
    });
  });

  await page.goto("/intelligence/watchlist");
  await page.getByRole("tab", { name: "Protected factions watchlist" }).click();
  await expect(
    page.getByRole("heading", { name: "Protected factions watchlist" }),
  ).toBeVisible();
  await expect(page.getByText("Aegis Prime", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Aegis Shield is present in this system"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Rules" }).click();
  await page.getByRole("button", { name: "Catalog" }).click();
  await expect(page.getByText("Protected Faction Early Warning")).toBeVisible();
  await page.getByRole("button", { name: "Apply template" }).click();
  const applyDialog = page.getByRole("dialog", {
    name: "Protected Faction Early Warning",
  });
  await expect(
    applyDialog.getByRole("combobox", {
      name: "Protected faction",
      exact: true,
    }),
  ).toHaveValue("9");
  await expect(
    applyDialog.getByLabel("Send to the protected faction Discord webhook"),
  ).toBeChecked();
  await applyDialog.getByRole("button", { name: "Apply package" }).click();
  await expect
    .poll(() => applied)
    .toEqual({
      watchlist_scope: "protected",
      protected_faction_id: 9,
      discord: true,
    });
});

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
  const protectedCatalogCard = page
    .getByText("Protected Faction Early Warning")
    .locator("xpath=ancestor::article");
  await expect(protectedCatalogCard).toBeVisible();
  await expect(protectedCatalogCard).not.toContainText("Tenant faction");
  await expect(protectedCatalogCard).toContainText(
    "Protected faction loses influence · 3 pp",
  );
  await expect(protectedCatalogCard).toContainText(
    "Protected faction enters a conflict: Election, War",
  );
  await expect(protectedCatalogCard).toContainText(
    "Protected faction below threshold · 5 pp",
  );
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

test("admins can manage protected factions without exposing webhook secrets", async ({
  page,
}) => {
  const mutations: { path: string; method: string; body: unknown }[] = [];
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], unread_count: 0 }),
    }),
  );
  await page.route("**/api/admin/protected-factions**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/candidates")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [{ name: "East India Company" }] }),
      });
      return;
    }
    if (request.method() !== "GET") {
      mutations.push({
        path: url.pathname,
        method: request.method(),
        body: request.postDataJSON?.() ?? null,
      });
      await route.fulfill({
        status:
          request.method() === "POST" && !url.pathname.endsWith("webhook-test")
            ? 201
            : 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: 7,
            name: "Aegis Shield",
            description: "Primary ally",
            protected: true,
            webhook_configured: true,
          },
          {
            id: 8,
            name: "Beacon Guard",
            description: "Reserve ally",
            protected: false,
            webhook_configured: false,
          },
        ],
      }),
    });
  });

  await page.goto("/admin/protected-factions");
  await expect(
    page.getByRole("heading", { name: "Protected factions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Protected factions" }),
  ).toBeVisible();
  await expect(page.getByText("Aegis Shield", { exact: true })).toBeVisible();
  await expect(page.getByText("Discord configured")).toBeVisible();
  await expect(page.getByText(/private_token/)).toHaveCount(0);

  await page.getByRole("button", { name: "New protected faction" }).click();
  const createDialog = page.getByRole("dialog", {
    name: "Create protected faction",
  });
  const factionName = createDialog.getByLabel("Faction name");
  await factionName.fill("Eas");
  await expect(
    createDialog.getByRole("option", { name: "East India Company" }),
  ).toBeVisible();
  await createDialog
    .getByRole("option", { name: "East India Company" })
    .click();
  await expect(factionName).toHaveValue("East India Company");
  await createDialog.getByLabel("Description").fill("New ally");
  const webhookInput = createDialog.getByLabel(
    "Discord webhook URL (optional)",
  );
  await expect(webhookInput).toHaveAttribute("type", "url");
  await webhookInput.fill("https://discord.com/api/webhooks/123/private_token");
  await createDialog.getByRole("button", { name: "Create faction" }).click();
  await expect
    .poll(() => mutations[0])
    .toEqual({
      path: "/api/admin/protected-factions",
      method: "POST",
      body: {
        name: "East India Company",
        description: "New ally",
        protected: true,
        webhook_url: "https://discord.com/api/webhooks/123/private_token",
      },
    });

  const aegisRow = page
    .getByText("Aegis Shield", { exact: true })
    .locator("xpath=ancestor::article");
  await aegisRow.getByRole("button", { name: "Test webhook" }).click();
  await expect
    .poll(() => mutations.at(-1)?.path)
    .toBe("/api/admin/protected-factions/7/webhook-test");

  const accessibility = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("refresh actions and named views preserve their distinct semantics", async ({
  page,
}) => {
  let storedPreference: unknown = null;
  await page.route("**/api/preferences/leaderboard", async (route) => {
    if (route.request().method() === "PUT") {
      storedPreference = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: storedPreference }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });

  await page.goto("/analytics/leaderboard");
  const period = page.getByRole("combobox", { name: "Period" });
  await expect(period).toHaveValue("cm");
  await period.selectOption("all");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(period).toHaveValue("all");

  await page
    .getByRole("button", { name: "Reset view and refresh dashboard" })
    .click();
  await expect(period).toHaveValue("cm");

  await period.selectOption("lm");
  await page.getByRole("button", { name: "Views" }).click();
  await page.getByRole("menuitem", { name: "Save current view as…" }).click();
  const dialog = page.getByRole("dialog", { name: "Save current view" });
  await dialog.getByRole("textbox", { name: "View name" }).fill("Last month");
  await dialog.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: /Last month/ })).toBeVisible();

  await period.selectOption("all");
  await page.getByRole("button", { name: /Last month/ }).click();
  await page.getByRole("menuitem", { name: "Last month" }).click();
  await expect(period).toHaveValue("lm");
  await expect
    .poll(() =>
      Array.isArray((storedPreference as { views?: unknown[] } | null)?.views),
    )
    .toBe(true);
});

test("evaluations applies period and metric to the requested visual only", async ({
  page,
}) => {
  await page.route("**/api/preferences/evaluations", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
  const detailRequests: URL[] = [];
  await page.route("**/api/bff/evaluations?*", async (route) => {
    detailRequests.push(new URL(route.request().url()));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: Array.from({ length: 12 }, (_, index) => ({
          position: index + 1,
          cmdr: `Commander ${index + 1}`,
          squadronRank: "Pilot",
          missions: 20 - index,
          missionFailures: index,
          profit: (index + 1) * 1000,
          quantity: (index + 1) * 10,
          bountyVouchers: (index + 1) * 100,
          combatBonds: (index + 1) * 50,
        })),
        metrics: {
          commanders: 12,
          missions: 174,
          quantity: 780,
          bountyVouchers: 7800,
        },
        generated_at: "2026-09-03T12:00:00Z",
      }),
    });
  });
  let historyRequest: URL | null = null;
  const historyParam = (key: string) =>
    historyRequest instanceof URL ? historyRequest.searchParams.get(key) : null;
  await page.route("**/api/bff/evaluations/history?*", async (route) => {
    historyRequest = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        metric: historyRequest.searchParams.get("metric"),
        limit: historyRequest.searchParams.get("mode") === "top5" ? 5 : 10,
        range: {
          start: "2026-08-31T00:00:00.000Z",
          end: "2026-09-07T00:00:00.000Z",
          label: "2026-08-31 – 2026-09-07 UTC",
          granularity: "day",
        },
        buckets: [
          { key: "0", label: "Mon, 31 Aug" },
          { key: "1", label: "Tue, 01 Sept" },
        ],
        series: [{ name: "Commander 1", data: [100, 200], total: 300 }],
        generated_at: "2026-09-03T12:00:00Z",
      }),
    });
  });

  await page.goto("/analytics/evaluations");
  await expect(
    page.getByRole("heading", { name: "Evaluations", exact: true }),
  ).toBeVisible();
  const period = page.getByRole("combobox", { name: "Period" });
  const metric = page.getByRole("combobox", { name: "Metric" });
  await expect(period).toHaveValue("all");
  await expect(metric).toHaveValue("missions");
  await expect(
    page.getByRole("heading", {
      name: "Missions Completed totals by commander",
    }),
  ).toBeVisible();

  await period.selectOption("cw");
  await expect
    .poll(() => detailRequests.at(-1)?.searchParams.get("period"))
    .toBe("cw");
  await metric.selectOption("profit");
  expect(
    detailRequests.every((request) => !request.searchParams.has("metric")),
  ).toBe(true);

  await page.getByRole("button", { name: "Historical trend" }).click();
  await expect(
    page.getByRole("heading", { name: "Profit historical trend" }),
  ).toBeVisible();
  await expect.poll(() => historyParam("period")).toBe("cw");
  expect(historyParam("metric")).toBe("profit");
  expect(historyParam("mode")).toBe("full");
  await expect(page.locator(".chart-surface canvas")).toBeVisible();

  await page.getByRole("button", { name: "Top 5 by missions" }).click();
  await expect.poll(() => historyParam("mode")).toBe("top5");
  await expect(page.getByText(/Top 5 · Metric does not filter/)).toHaveCount(1);
});

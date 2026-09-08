import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("edits labels, filters every watchlist and opens the system link menu", async ({
  page,
}, testInfo) => {
  const system = "Preae Aihm DN-I c23-44";
  let personal = [{ system, sector: "", projectName: "", favorite: true }];
  let shared = { system, sector: "", projectName: "" };
  const requests: URL[] = [];
  const data = () => [
    {
      requested_system: system,
      available: true,
      system_info: {
        system_name: system,
        controlling_faction: "Valkyrie Galactic Security",
        population: 1000,
      },
      factions: [{ name: "Valkyrie Galactic Security", influence: 0.4 }],
      history: [],
      conflicts: [],
      watchlist_labels: shared,
    },
  ];
  await page.route("**/api/preferences/**", (route) =>
    route.fulfill({ json: { data: null } }),
  );
  await page.route("**/api/bgs-alerts**", (route) =>
    route.fulfill({ json: { data: [], unread_count: 0 } }),
  );
  await page.route("**/api/system-watchlist**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/labels")) {
      shared = request.postDataJSON();
      return route.fulfill({ json: { data: shared } });
    }
    if (
      url.pathname === "/api/system-watchlist" &&
      request.method() === "PUT"
    ) {
      personal = request.postDataJSON().systems;
      return route.fulfill({ json: { data: {} } });
    }
    if (url.pathname.endsWith("/data"))
      return route.fulfill({ json: { watchlist: personal, data: data() } });
    requests.push(url);
    return route.fulfill({
      json: {
        data: data(),
        pagination: { page: 1, page_size: 25, total: 1 },
        filter_options: {
          sectors: shared.sector ? [shared.sector] : [],
          projects: shared.projectName ? [shared.projectName] : [],
          allegiances: [],
          governments: [],
        },
        protected_factions: [
          {
            id: 7,
            name: "Valkyrie Galactic Security",
            description: "",
            webhook_configured: false,
          },
        ],
      },
    });
  });

  await page.goto("/intelligence/watchlist");
  for (const [scope, tab, sector, project] of [
    ["personal", "Personal watchlist", "Personal sector", "Personal project"],
    ["global", "Global watchlist", "Shared sector", "Shared project"],
    [
      "protected",
      "Protected factions watchlist",
      "Shared sector",
      "Protected project",
    ],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page
      .getByRole("button", { name: `Edit sector and project for ${system}` })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Sector and project",
      exact: true,
    });
    await dialog.getByLabel("Sector", { exact: true }).fill(sector);
    await dialog.getByLabel("Project name", { exact: true }).fill(project);
    await expect(dialog).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include(".watch-labels-dialog")
      .analyze();
    expect(audit.violations).toEqual([]);
    await dialog.getByRole("button", { name: "Save labels" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByText(`${sector} / ${project}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("dialog");
    await filters
      .getByRole("combobox", { name: "Sector", exact: true })
      .selectOption(sector);
    await filters
      .getByRole("combobox", { name: "Project name", exact: true })
      .selectOption(project);
    await filters.getByRole("button", { name: "Apply filters" }).click();
    if (scope !== "personal")
      await expect
        .poll(() =>
          requests.some(
            (url) =>
              url.pathname.endsWith(`/${scope}`) &&
              url.searchParams.get("sector") === sector &&
              url.searchParams.get("project_name") === project,
          ),
        )
        .toBe(true);
    await expect(
      page.getByRole("button", {
        name: `Open record detail and influence history for ${system}`,
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel(`Open full system information for ${system}`),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: `External links for ${system}` })
      .click();
    for (const name of ["Raven Colonial", "Inara", "Spansh"])
      await expect(page.getByRole("menuitem", { name })).toHaveAttribute(
        "target",
        "_blank",
      );
    await page.screenshot({
      path: testInfo.outputPath(`${scope}-links.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
  }
  expect(personal[0]).toEqual({
    system,
    sector: "Personal sector",
    projectName: "Personal project",
    favorite: true,
  });
  await page
    .getByRole("tab", { name: "Global watchlist", exact: true })
    .click();
  await expect(
    page
      .getByRole("tabpanel")
      .getByText("Shared sector / Protected project", { exact: true }),
  ).toBeVisible();
});

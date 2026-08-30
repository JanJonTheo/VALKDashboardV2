import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const rows = [
  {
    id: 452,
    timestamp: "2026-03-19T09:34:54Z",
    event: "StartUp",
    cmdr: "TORVYR",
    starsystem: "IC 2602 Sector FB-X d1-134",
    systemaddress: 46148165328359,
    tickid: "zoy-tick-2",
    raw_json: JSON.stringify({
      timestamp: "2026-03-19T09:34:54Z",
      event: "StartUp",
      StarSystem: "IC 2602 Sector FB-X d1-134",
      StarPos: [613.09375, 31.28125, 159.875],
      Docked: false,
      StationFaction: { Name: "East India Company" },
    }),
  },
  {
    id: 453,
    timestamp: "2026-03-19T09:35:14Z",
    event: "FSDJump",
    cmdr: "TORVYR",
    starsystem: "IC 2602 Sector GW-V c2-4",
    systemaddress: 1184370823922,
    tickid: "zoy-tick-2",
    raw_json: JSON.stringify({ event: "FSDJump", Taxi: false }),
  },
  {
    id: 454,
    timestamp: "2026-03-20T10:00:00Z",
    event: "ColonisationContribution",
    cmdr: "ASTRA NYX",
    starsystem: "HIP 10792",
    systemaddress: 42,
    tickid: "zoy-tick-1",
    raw_json: JSON.stringify({
      event: "ColonisationContribution",
      Commodity: "Steel",
    }),
  },
];

test("data explorer supports legacy filters, JSON detail and record export", async ({
  page,
}) => {
  let lastRequest: URL | undefined;
  await page.route("**/api/bff/data-explorer**", async (route) => {
    const url = new URL(route.request().url());
    lastRequest = url;
    const isOptions = url.searchParams.get("options") === "1";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: isOptions ? [] : rows,
        metrics: { rows: rows.length, returned: isOptions ? 0 : rows.length },
        generated_at: "2026-08-29T12:00:00Z",
        pagination: {
          page: 1,
          page_size: Number(url.searchParams.get("page_size") ?? 50),
          total: rows.length,
        },
        meta: {
          columns: Object.keys(rows[0]),
          filter_options: {
            cmdrs: ["ASTRA NYX", "TORVYR"],
            events: ["ColonisationContribution", "FSDJump", "StartUp"],
            tickids: ["zoy-tick-2", "zoy-tick-1"],
          },
        },
      }),
    });
  });

  await page.goto("/admin/data-explorer");
  await expect(
    page.getByRole("heading", { name: "Data explorer", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("combobox", { name: "Table type", exact: true }),
  ).toHaveValue("event");
  await expect(
    page.getByRole("combobox", { name: "Cmdr", exact: true }),
  ).toContainText("TORVYR");
  await expect(
    page.getByRole("combobox", { name: "Event", exact: true }),
  ).toContainText("ColonisationContribution");
  await expect(
    page.getByRole("combobox", { name: "Tick ID", exact: true }),
  ).toContainText("zoy-tick-2");

  await page.getByLabel("Colonisation only").check();
  await expect
    .poll(() => lastRequest?.searchParams.get("filters"))
    .toContain('"value":"Colonisation"');
  await page.getByLabel("Date filter").check();
  await page.getByLabel("From", { exact: true }).fill("2026-03-19");
  await page.getByLabel("To", { exact: true }).fill("2026-03-20");
  await expect
    .poll(() => lastRequest?.searchParams.get("filters"))
    .toContain("2026-03-20T23:59:59.999Z");

  await page.getByRole("button", { name: "Sort by Cmdr" }).click();
  await expect.poll(() => lastRequest?.searchParams.get("sort")).toBe("cmdr");
  await expect
    .poll(() => lastRequest?.searchParams.get("direction"))
    .toBe("asc");

  await page.getByLabel("Search all table fields").fill("East India Company");
  await expect
    .poll(() => lastRequest?.searchParams.get("scope"), { timeout: 10_000 })
    .toBe("all");
  await expect(page.getByText("1 rows from event")).toBeVisible();

  const tableScroll = page.getByRole("region", {
    name: "Scrollable database records",
  });
  await expect(tableScroll).toBeVisible();
  const scrollBehaviour = await tableScroll.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      overflowX: styles.overflowX,
      overflowY: styles.overflowY,
      touchAction: styles.touchAction,
    };
  });
  expect(scrollBehaviour.overflowX).toBe("auto");
  expect(scrollBehaviour.overflowY).toBe("auto");
  expect(scrollBehaviour.touchAction).toBe("pan-x pan-y");

  await page.getByRole("button", { name: "View JSON" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Record detail" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("StationFaction")).toBeVisible();
  await expect(drawer.getByText('"East India Company"')).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await expect
    .poll(async () => {
      const drawerBox = await drawer.boundingBox();
      if (!drawerBox) return Number.POSITIVE_INFINITY;
      return Math.abs(drawerBox.x + drawerBox.width - viewport!.width);
    })
    .toBeLessThanOrEqual(2);

  await drawer.getByRole("button", { name: "Close record detail" }).click();
  await expect(drawer).toBeHidden();

  await page.getByLabel("Select record 452").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("event-selected.csv");

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) =>
      ["critical", "serious"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

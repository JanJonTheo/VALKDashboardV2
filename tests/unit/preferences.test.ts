import { describe, expect, it } from "vitest";
import {
  defaultViewPreference,
  leaderboardMetricOptions,
  preferencePayload,
  viewCollectionPayload,
  viewCollectionSchema,
} from "@/lib/preferences";

describe("dashboard view preferences", () => {
  it("uses the approved current-month and missions defaults", () => {
    const preference = defaultViewPreference("leaderboard", [
      "cmdr",
      "missions",
    ]);
    expect(preference.period).toBe("cm");
    expect(preference.metric).toBe("missions");
    expect(preference.sorting).toEqual([{ id: "missions", desc: true }]);
  });

  it("uses period and metric controls without coupling evaluation details to metric changes", () => {
    const preference = defaultViewPreference("evaluations", [
      "cmdr",
      "missions",
    ]);
    expect(preference).toMatchObject({
      period: "all",
      metric: "missions",
      chartMode: "totals",
      variant: "full",
      sorting: [{ id: "missions", desc: true }],
    });
  });

  it("accepts every supported leaderboard metric", () => {
    expect(leaderboardMetricOptions).toHaveLength(12);
    for (const metric of leaderboardMetricOptions) {
      expect(
        preferencePayload({
          filters: {},
          sorting: [],
          visibleColumns: [],
          pageSize: 25,
          metric: metric.value,
        })?.metric,
      ).toBe(metric.value);
    }
  });

  it("rejects oversized page sizes and unknown metrics", () => {
    expect(
      preferencePayload({
        filters: {},
        sorting: [],
        visibleColumns: [],
        pageSize: 1000,
        metric: "unknown",
      }),
    ).toBeNull();
  });

  it("accepts legacy single filters and persisted multi-select values", () => {
    const preference = preferencePayload({
      filters: {
        system: "Synookoi",
        cmdr: ["JanJonTheo", "Unattributed deliveries"],
        commodity: ["Aluminium", "Water"],
      },
      sorting: [{ id: "colonisation:constructions:system", desc: false }],
      visibleColumns: [],
      pageSize: 25,
    });
    expect(preference?.filters.system).toBe("Synookoi");
    expect(preference?.filters.cmdr).toEqual([
      "JanJonTheo",
      "Unattributed deliveries",
    ]);
  });

  it("persists the fifth Colonisation tab, its sorting and Commodity Diff", () => {
    const current = preferencePayload({
      variant: "commodity-constructions",
      filters: { commodity_diff: "yes", commodity: ["Aluminium", "Water"] },
      sorting: [
        { id: "colonisation:commodity-constructions:diff", desc: true },
      ],
    });
    expect(current?.variant).toBe("commodity-constructions");
    expect(current?.filters.commodity_diff).toBe("yes");
    expect(current?.sorting).toEqual([
      { id: "colonisation:commodity-constructions:diff", desc: true },
    ]);
  });

  it("migrates a legacy preference into the current view collection", () => {
    const fallback = defaultViewPreference("evaluations", ["cmdr"]);
    const collection = viewCollectionPayload(
      {
        filters: { commander: "Test Pilot" },
        sorting: [{ id: "missions", desc: true }],
        visibleColumns: ["cmdr"],
        pageSize: 25,
      },
      fallback,
    );
    expect(collection.current.filters.commander).toBe("Test Pilot");
    expect(collection.views).toEqual([]);
    expect(collection.activeViewId).toBeNull();
  });

  it("rejects duplicate names and missing active views", () => {
    const current = defaultViewPreference("evaluations", ["cmdr"]);
    const now = new Date().toISOString();
    expect(
      viewCollectionSchema.safeParse({
        current,
        activeViewId: "missing",
        views: [
          {
            id: "one",
            name: "My view",
            view: current,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "two",
            name: "MY VIEW",
            view: current,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  defaultViewPreference,
  leaderboardMetricOptions,
  preferencePayload,
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
});

import { describe, expect, it } from "vitest";
import {
  HOME_ACTIVITY_METRICS,
  contributionPercentage,
  formatTickCountdown,
  getTickSchedule,
  summarizeHomeLeaderboard,
} from "@/lib/home";
import { normalizeFeaturePayload } from "@/lib/normalize";

describe("home current-tick activity", () => {
  it("normalizes and aggregates every contribution metric from leaderboard rows", () => {
    const normalized = normalizeFeaturePayload("leaderboard", {
      data: [
        {
          cmdr: "Valkyrie",
          influence_eic: "2",
          bounty_vouchers: "1000",
          exploration_sales: "250",
          combat_bonds: "300",
          total_volume: "700",
        },
        {
          cmdr: "Rooke",
          influence_eic: 3,
          exploration_sales: 750,
          combat_bonds: "not-a-number",
          total_volume: 300,
        },
        {
          cmdr: " ",
          influence_eic: 99,
          bounty_vouchers: 99,
          exploration_sales: 99,
          combat_bonds: 99,
          total_volume: 99,
        },
      ],
    }).data;

    const summary = summarizeHomeLeaderboard(normalized);

    expect(summary.activeCommanders).toBe(2);
    expect(summary.metrics).toEqual({
      influence: 5,
      bountyVouchers: 1000,
      explorationSales: 1000,
      combatBonds: 300,
      tradeVolume: 1000,
    });
    expect(summary.activity).toEqual([
      {
        cmdr: "Valkyrie",
        influence: 2,
        bountyVouchers: 1000,
        explorationSales: 250,
        combatBonds: 300,
        tradeVolume: 700,
      },
      {
        cmdr: "Rooke",
        influence: 3,
        bountyVouchers: 0,
        explorationSales: 750,
        combatBonds: 0,
        tradeVolume: 300,
      },
    ]);
  });

  it("uses the KPI totals as the contribution-share denominators", () => {
    const summary = summarizeHomeLeaderboard([
      {
        cmdr: "Valkyrie",
        influence: 25,
        bountyVouchers: 75,
        explorationSales: 0,
        combatBonds: 10,
        volume: 40,
      },
      {
        cmdr: "Rooke",
        influence: 75,
        bountyVouchers: 25,
        explorationSales: 0,
        combatBonds: 30,
        volume: 60,
      },
    ]);

    for (const { key } of HOME_ACTIVITY_METRICS) {
      const shares = summary.activity.map((row) =>
        contributionPercentage(row[key], summary.metrics[key]),
      );
      if (summary.metrics[key] === 0) expect(shares).toEqual([0, 0]);
      else expect(shares.reduce((total, share) => total + share, 0)).toBe(100);
    }
  });

  it("returns a stable zero percentage for empty or invalid totals", () => {
    expect(contributionPercentage(100, 0)).toBe(0);
    expect(contributionPercentage(100, undefined)).toBe(0);
    expect(contributionPercentage("invalid", 100)).toBe(0);
  });

  it("estimates the next galaxy tick exactly 24 hours after the last tick", () => {
    const schedule = getTickSchedule("2026-08-29T10:18:02Z");

    expect(schedule.lastTick?.toISOString()).toBe("2026-08-29T10:18:02.000Z");
    expect(schedule.estimatedNextTick?.toISOString()).toBe(
      "2026-08-30T10:18:02.000Z",
    );
    expect(getTickSchedule(null)).toEqual({
      lastTick: null,
      estimatedNextTick: null,
    });
    expect(getTickSchedule("not-a-date")).toEqual({
      lastTick: null,
      estimatedNextTick: null,
    });
  });

  it("formats the remaining tick time in hours and minutes", () => {
    const nextTick = new Date("2026-08-30T10:18:02Z");

    expect(
      formatTickCountdown(nextTick, Date.parse("2026-08-30T08:48:02Z")),
    ).toBe("01:30");
    expect(
      formatTickCountdown(nextTick, Date.parse("2026-08-30T10:18:01Z")),
    ).toBe("00:01");
    expect(
      formatTickCountdown(nextTick, Date.parse("2026-08-30T10:18:02Z")),
    ).toBe("00:00");
    expect(
      formatTickCountdown(nextTick, Date.parse("2026-08-30T10:18:03Z")),
    ).toBe("Overdue (-1 Minutes)");
    expect(
      formatTickCountdown(nextTick, Date.parse("2026-08-30T10:34:02Z")),
    ).toBe("Overdue (-16 Minutes)");
    expect(formatTickCountdown(null)).toBe("—");
    expect(formatTickCountdown(new Date("invalid"))).toBe("—");
  });
});

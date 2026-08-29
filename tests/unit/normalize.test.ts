import { describe, expect, it } from "vitest";
import { normalizeFeaturePayload } from "@/lib/normalize";

describe("Flask contract normalization", () => {
  it("keeps squadron rank separate from the alphabetical row number", () => {
    const result = normalizeFeaturePayload("leaderboard", {
      data: [
        {
          cmdr: "Valkyrie",
          rank: "Squadron commander",
          total_buy: 120,
          total_sell: 180,
          profit: 60,
          profitability: 50,
        },
      ],
      generated_at: "2026-08-28T00:00:00Z",
    });
    expect(result.data[0]).toMatchObject({
      position: 1,
      cmdr: "Valkyrie",
      squadronRank: "Squadron commander",
      buy: 120,
      sell: 180,
      profit: 60,
      profitability: 50,
    });
    expect(result.metrics).toMatchObject({ commanders: 1, profit: 60 });
  });

  it("uses the actual API months for the three monthly score slots", () => {
    const result = normalizeFeaturePayload("monthly-performance", {
      data: [
        { month: "2026-05", cmdr: "Valkyrie", profit: 100 },
        { month: "2026-06", cmdr: "Valkyrie", profit: 200 },
        { month: "2026-07", cmdr: "Valkyrie", profit: 300 },
        { month: "2026-07", cmdr: "Rooke", profit: 150 },
      ],
    });
    expect(result.meta).toEqual({ months: ["2026-05", "2026-06", "2026-07"] });
    expect(result.data[0]).toMatchObject({
      cmdr: "Valkyrie",
      month1: 100,
      month2: 100,
      month3: 100,
      score: 100,
    });
  });

  it("flattens a single EDDN system summary without losing its details", () => {
    const result = normalizeFeaturePayload("systems", {
      system_info: {
        system_name: "HIP 52503",
        population: 486193,
        controlling_faction: "East India Company",
        government: "$government_Corporate;",
        security: "$SYSTEM_SECURITY_low;",
      },
      factions: [
        { name: "East India Company", influence: 0.468, state: "None" },
      ],
      conflicts: [{ faction1: "Blackiron", faction2: "East India Company" }],
      powerplays: [],
    });
    expect(result.data[0]).toMatchObject({
      system: "HIP 52503",
      population: 486193,
      controllingFaction: "East India Company",
      government: "Corporate",
      security: "Low",
      factionCount: 1,
      conflictCount: 1,
    });
    expect(result.metrics).toMatchObject({
      systems: 1,
      population: 486193,
      factions: 1,
      conflicts: 1,
    });
  });

  it("flattens the uppercase 24h FSDJump response into faction rows", () => {
    const result = normalizeFeaturePayload("factions-24h", {
      data: [
        {
          StarSystem: "Synookoi AJ-A c14-30",
          Timestamp: "2026-08-27T23:10:35Z",
          Factions: [
            {
              Name: "Valkyrie Galactic Security",
              FactionState: "Expansion",
              Influence: 0.6,
              PendingStates: [],
              RecoveringStates: [],
            },
          ],
        },
      ],
    });
    expect(result.data[0]).toMatchObject({
      system: "Synookoi AJ-A c14-30",
      faction: "Valkyrie Galactic Security",
      state: "Expansion",
      influence: 60,
    });
    expect(result.metrics).toMatchObject({
      factions: 1,
      systems: 1,
      updates: 1,
    });
  });

  it("uses Colonisation contribution records and API totals", () => {
    const result = normalizeFeaturePayload("colonisation", {
      groups: [
        {
          key: "janjontheo",
          label: "JanJonTheo",
          cmdr: "JanJonTheo",
          quantity: 40,
          event_count: 1,
          commodities: [
            {
              commodity_key: "titanium",
              commodity: "Titanium",
              quantity: 40,
              event_count: 1,
            },
          ],
          subgroups: [
            {
              key: "42",
              label: "Cook Vision",
              market_id: 42,
              target_system: "Synookoi",
              quantity: 40,
              event_count: 1,
              commodities: [
                {
                  commodity_key: "titanium",
                  commodity: "Titanium",
                  quantity: 40,
                  event_count: 1,
                },
              ],
            },
          ],
        },
      ],
      records: [
        {
          construction: "Cook Vision",
          cmdr: "JanJonTheo",
          commodity: "Titanium",
          quantity: 40,
        },
      ],
      totals: {
        quantity: 40,
        cmdr_count: 1,
        construction_count: 1,
      },
    });
    expect(result.data[0]).toMatchObject({
      construction: "Cook Vision",
      cmdr: "JanJonTheo",
      commodity: "Titanium",
      delivered: 40,
    });
    expect(result.metrics).toMatchObject({
      delivered: 40,
      required: 0,
      commanders: 1,
      constructions: 1,
    });
    expect(result.meta).toMatchObject({
      contributionGroups: [
        {
          id: "janjontheo",
          cmdr: "JanJonTheo",
          delivered: 40,
          events: 1,
          commodities: [{ commodity: "Titanium", delivered: 40, events: 1 }],
          constructions: [
            {
              id: "42",
              construction: "Cook Vision",
              system: "Synookoi",
              delivered: 40,
              commodities: [{ commodity: "Titanium", delivered: 40 }],
            },
          ],
        },
      ],
    });
  });

  it("uses construction rows without multiplying aggregate requirements", () => {
    const result = normalizeFeaturePayload("colonisation", {
      constructions: [
        {
          market_id: 42,
          label: "Cook Vision",
          status: "open",
          target_system: "Synookoi",
          total_need: 50,
          total_provided: 20,
          total_remaining: 30,
          commodities: [
            {
              commodity_key: "titanium",
              commodity: "Titanium",
              need: 50,
              provided: 20,
              remaining: 30,
              unrecorded_quantity: 5,
              contributors: [{ cmdr: "One", quantity: 15 }],
            },
          ],
        },
      ],
      rows: [
        {
          construction: "Cook Vision",
          construction_status: "open",
          cmdr: "One",
          commodity: "Titanium",
          need: 50,
          provided: 10,
        },
        {
          construction: "Cook Vision",
          construction_status: "open",
          cmdr: "Two",
          commodity: "Titanium",
          need: 50,
          provided: 10,
        },
      ],
      totals: {
        construction_count: 1,
        total_need: 50,
        total_provided: 10,
      },
    });
    expect(result.data[0]).toMatchObject({ status: "open" });
    expect(result.metrics).toMatchObject({
      delivered: 10,
      required: 50,
      commanders: 2,
      constructions: 1,
    });
    expect(result.meta).toMatchObject({
      constructions: [
        {
          id: "42",
          construction: "Cook Vision",
          system: "Synookoi",
          need: 50,
          delivered: 20,
          diff: 30,
          commodities: [
            {
              commodity: "Titanium",
              need: 50,
              delivered: 20,
              diff: 30,
              unrecorded: 5,
              contributors: [{ cmdr: "One", delivered: 15 }],
            },
          ],
        },
      ],
    });
  });
});

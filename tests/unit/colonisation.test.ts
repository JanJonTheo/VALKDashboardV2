import { describe, expect, it } from "vitest";
import {
  colonisationCommanderGroups,
  colonisationCommodityGroups,
  filterColonisationContributionGroups,
  filterColonisationContributionRecords,
  filterColonisationConstructions,
  groupColonisationContributionRecords,
  includeUnattributedColonisationContributionGroups,
  includeUnattributedColonisationContributionRecords,
  normalizeColonisationContributionGroups,
  normalizeColonisationContributionRecords,
  visualAnalysisConstructions,
  visualAnalysisContributionGroups,
  type ColonisationConstruction,
} from "@/lib/colonisation";

const construction: ColonisationConstruction = {
  id: "42",
  construction: "Ivaldi Foundry",
  system: "Synookoi",
  status: "open",
  need: 150,
  delivered: 80,
  diff: 70,
  commodities: [
    {
      key: "aluminium",
      commodity: "Aluminium",
      need: 100,
      delivered: 70,
      diff: 30,
      unrecorded: 10,
      contributors: [
        { cmdr: "JanJonTheo", delivered: 40 },
        { cmdr: "Valkyrie", delivered: 20 },
      ],
    },
    {
      key: "water",
      commodity: "Water",
      need: 50,
      delivered: 10,
      diff: 40,
      unrecorded: 0,
      contributors: [{ cmdr: "JanJonTheo", delivered: 10 }],
    },
  ],
};

describe("Colonisation construction presentation", () => {
  it("creates Cmdr groups with unique commodity need and group sums", () => {
    const groups = colonisationCommanderGroups(construction);
    expect(groups[0]).toMatchObject({
      cmdr: "JanJonTheo",
      need: 150,
      delivered: 50,
      diff: 100,
    });
    expect(groups[0].commodities.map((row) => row.commodity.commodity)).toEqual(
      ["Aluminium", "Water"],
    );
    expect(groups.at(-1)).toMatchObject({
      cmdr: "Unattributed deliveries",
      need: 100,
      delivered: 10,
      diff: 90,
    });
  });

  it("aggregates duplicate Cmdr contributions in both group directions", () => {
    const withDuplicateContribution: ColonisationConstruction = {
      ...construction,
      commodities: [
        {
          ...construction.commodities[0],
          contributors: [
            ...construction.commodities[0].contributors,
            { cmdr: "JanJonTheo", delivered: 5 },
          ],
        },
        construction.commodities[1],
      ],
    };

    const commander = colonisationCommanderGroups(
      withDuplicateContribution,
    ).find((group) => group.cmdr === "JanJonTheo");
    expect(commander).toMatchObject({ delivered: 55 });
    expect(
      commander?.commodities.find((row) => row.commodity.key === "aluminium"),
    ).toMatchObject({ delivered: 45, diff: 55 });

    const commodity = colonisationCommodityGroups(
      withDuplicateContribution,
    ).find((group) => group.commodity.key === "aluminium");
    expect(commodity?.contributions).toContainEqual({
      cmdr: "JanJonTheo",
      delivered: 45,
    });
  });

  it("finds constructions by construction, commodity, or commander", () => {
    expect(
      filterColonisationConstructions([construction], "foundry"),
    ).toHaveLength(1);
    expect(
      filterColonisationConstructions([construction], "water"),
    ).toHaveLength(1);
    expect(
      filterColonisationConstructions([construction], "valkyrie"),
    ).toHaveLength(1);
    expect(filterColonisationConstructions([construction], "missing")).toEqual(
      [],
    );
    expect(
      filterColonisationConstructions([construction], "", {
        cmdr: ["JanJonTheo"],
        status: "open",
        system: "Synookoi",
        commodity: ["Water"],
      })[0],
    ).toMatchObject({
      need: 150,
      delivered: 80,
      diff: 70,
      commodities: [{ commodity: "Water" }],
    });
  });

  it("applies multi-select filters without changing Construction totals", () => {
    const filtered = filterColonisationConstructions([construction], "", {
      cmdr: ["JanJonTheo", "Unattributed deliveries"],
      commodity: ["Aluminium", "Water"],
      status: "open",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      need: 150,
      delivered: 80,
      diff: 70,
    });
    expect(filtered[0].commodities).toEqual([
      expect.objectContaining({
        commodity: "Aluminium",
        delivered: 50,
        unrecorded: 10,
      }),
      expect.objectContaining({ commodity: "Water", delivered: 10 }),
    ]);
  });

  it("normalizes and filters Contributions as Cmdr, Construction, Commodity", () => {
    const groups = normalizeColonisationContributionGroups(
      [
        {
          key: "janjontheo",
          label: "JanJonTheo",
          quantity: 75,
          event_count: 2,
          commodities: [{ commodity: "Titanium", quantity: 75 }],
          subgroups: [
            {
              key: "42",
              label: "Ivaldi Foundry",
              target_system: "Synookoi",
              quantity: 75,
              commodities: [{ commodity: "Titanium", quantity: 75 }],
            },
          ],
        },
      ],
      [construction],
    );
    expect(groups[0]).toMatchObject({
      cmdr: "JanJonTheo",
      delivered: 75,
      constructions: [
        {
          construction: "Ivaldi Foundry",
          system: "Synookoi",
          commodities: [{ commodity: "Titanium", delivered: 75 }],
        },
      ],
    });
    expect(filterColonisationContributionGroups(groups, "ivaldi")).toHaveLength(
      1,
    );
    expect(
      filterColonisationContributionGroups(groups, "titanium"),
    ).toHaveLength(1);
    expect(filterColonisationContributionGroups(groups, "missing")).toEqual([]);
    expect(
      filterColonisationContributionGroups(groups, "", {
        cmdr: ["JanJonTheo"],
        status: "open",
        system: "Synookoi",
        commodity: ["Titanium"],
      }),
    ).toHaveLength(1);
  });

  it("normalizes, filters, and chronologically groups contribution events", () => {
    const records = normalizeColonisationContributionRecords(
      [
        {
          event_id: 2,
          timestamp: "2026-08-28T11:00:00Z",
          cmdr: "Valkyrie",
          commodity: "Water",
          quantity: 20,
          market_id: 42,
          construction: "Ivaldi Foundry",
          target_system: "Synookoi",
        },
        {
          event_id: 1,
          timestamp: "2026-08-28T10:00:00Z",
          cmdr: "JanJonTheo",
          commodity: "Aluminium",
          quantity: 40,
          market_id: 42,
          construction: "Ivaldi Foundry",
          target_system: "Synookoi",
        },
      ],
      [construction],
    );

    expect(records[0]).toMatchObject({
      status: "open",
      system: "Synookoi",
      delivered: 20,
    });
    expect(
      filterColonisationContributionRecords(records, "", {
        cmdr: ["JanJonTheo"],
        status: "open",
        system: "Synookoi",
        commodity: ["Aluminium"],
        fromDate: "2026-08-28",
        toDate: "2026-08-28",
      }),
    ).toHaveLength(1);

    const grouped = groupColonisationContributionRecords(records);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].commanders.map((group) => group.cmdr)).toEqual([
      "JanJonTheo",
      "Valkyrie",
    ]);
    expect(grouped[0].records.map((record) => record.eventId)).toEqual([
      "1",
      "2",
    ]);
  });

  it("adds unattributed deliveries to contribution events without duplicating existing records", () => {
    const records = normalizeColonisationContributionRecords(
      [
        {
          event_id: 1,
          timestamp: "2026-08-28T10:00:00Z",
          cmdr: "JanJonTheo",
          commodity: "Aluminium",
          commodity_key: "aluminium",
          quantity: 40,
          market_id: 42,
        },
        {
          event_id: 2,
          timestamp: "2026-08-28T10:30:00Z",
          cmdr: "Valkyrie",
          commodity: "Aluminium",
          commodity_key: "aluminium",
          quantity: 20,
          market_id: 42,
        },
        {
          event_id: 3,
          timestamp: "2026-08-28T10:45:00Z",
          cmdr: "JanJonTheo",
          commodity: "Water",
          commodity_key: "water",
          quantity: 10,
          market_id: 42,
        },
        {
          event_id: 4,
          timestamp: "2026-08-28T11:00:00Z",
          cmdr: "Unattributed deliveries",
          commodity: "Aluminium",
          commodity_key: "aluminium",
          quantity: 4,
          market_id: 42,
        },
      ],
      [construction],
    );

    const completeRecords = includeUnattributedColonisationContributionRecords(
      records,
      [construction],
    );
    const unattributed = completeRecords.filter(
      (record) => record.cmdr === "Unattributed deliveries",
    );
    expect(unattributed).toHaveLength(2);
    expect(
      unattributed.reduce((total, record) => total + record.delivered, 0),
    ).toBe(10);
    expect(
      filterColonisationContributionRecords(completeRecords, "", {
        cmdr: ["Unattributed deliveries"],
      }),
    ).toHaveLength(2);

    const grouped = groupColonisationContributionRecords(completeRecords);
    expect(grouped[0].delivered).toBe(construction.delivered);
    expect(
      grouped[0].commanders.find(
        (group) => group.cmdr === "Unattributed deliveries",
      ),
    ).toMatchObject({ delivered: 10 });
  });

  it("adds unattributed deliveries to Cmdr contribution groups", () => {
    const groups = includeUnattributedColonisationContributionGroups(
      [],
      [construction],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      cmdr: "Unattributed deliveries",
      delivered: 10,
      events: 0,
      constructions: [
        {
          construction: "Ivaldi Foundry",
          delivered: 10,
          commodities: [{ commodity: "Aluminium", delivered: 10 }],
        },
      ],
    });
  });

  it("limits visual analysis by newest last event", () => {
    const constructions = [
      construction,
      { ...construction, id: "43", construction: "New Project" },
      { ...construction, id: "44", construction: "No Dated Event" },
    ];
    const records = normalizeColonisationContributionRecords(
      [
        {
          event_id: 1,
          timestamp: "2026-08-20T10:00:00Z",
          cmdr: "Older Cmdr",
          commodity: "Water",
          quantity: 10,
          market_id: 42,
        },
        {
          event_id: 2,
          timestamp: "2026-08-25T10:00:00Z",
          cmdr: "Newer Cmdr",
          commodity: "Water",
          quantity: 10,
          market_id: 43,
        },
        {
          event_id: 3,
          timestamp: "2026-08-29T10:00:00Z",
          cmdr: "Older Cmdr",
          commodity: "Aluminium",
          quantity: 10,
          market_id: 42,
        },
      ],
      constructions,
    );
    expect(
      visualAnalysisConstructions(constructions, records, 2).map(
        (item) => item.id,
      ),
    ).toEqual(["42", "43"]);

    const groups = [
      {
        id: "older",
        cmdr: "Older Cmdr",
        delivered: 20,
        events: 2,
        commodities: [],
        constructions: [],
      },
      {
        id: "newer",
        cmdr: "Newer Cmdr",
        delivered: 10,
        events: 1,
        commodities: [],
        constructions: [],
      },
    ];
    expect(
      visualAnalysisContributionGroups(groups, records, 1).map(
        (item) => item.cmdr,
      ),
    ).toEqual(["Older Cmdr"]);
  });
});

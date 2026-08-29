import { describe, expect, it } from "vitest";
import {
  colonisationCommanderGroups,
  colonisationCommodityGroups,
  filterColonisationContributionGroups,
  filterColonisationConstructions,
  normalizeColonisationContributionGroups,
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
  });

  it("normalizes and filters Contributions as Cmdr, Construction, Commodity", () => {
    const groups = normalizeColonisationContributionGroups([
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
    ]);
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
  });
});

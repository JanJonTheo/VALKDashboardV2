import type { FeatureKey } from "./features";

const names = [
  "Valkyrie",
  "Astra Nyx",
  "Rooke",
  "Kael Voss",
  "Lyra Dawn",
  "Orion Pax",
  "Sable",
  "Nova Kade",
];
const systems = [
  "HIP 10792",
  "Tsohoda",
  "Kutkha",
  "Col 285 Sector OS-T d3-143",
  "Maidubrigel",
  "Tir",
  "Cayutorme",
  "Arakapajo",
];
const factions = [
  "VALK Squadron",
  "Silver Galactic Navy",
  "Independent Tsohoda",
  "HIP 10792 Union",
];

function baseRow(index: number) {
  return {
    id: index + 1,
    rank: index + 1,
    cmdr: names[index],
    system: systems[index],
    faction: factions[index % factions.length],
    buy: 42 - index * 2,
    sell: 35 + index * 3,
    profit: 184_200_000 - index * 9_100_000,
    score: 94 - index * 5,
    activity: 126 - index * 8,
    systems: 8 - (index % 3),
    trend: index % 3 === 0 ? "▲ Rising" : "Stable",
    platform: "PC",
    lastSeen: `${index + 2} min ago`,
    status: index === 1 ? "At risk" : "Active",
    wins: 18 - index,
    bonds: 62_400_000 - index * 2_300_000,
    type: index % 2 ? "Ground" : "Space",
    redeemed: 52_000_000 - index * 3_100_000,
    transactions: 19 - index,
    joined: `2026-0${(index % 7) + 1}-12`,
    mentor: names[(index + 2) % names.length],
    june: 60 - index * 2,
    july: 70 - index,
    august: 78 - index * 2,
    title: [
      "Hold HIP 10792",
      "Expand Tsohoda",
      "Fortify VALK space",
      "Secure Kutkha",
      "Complete Stone Harbor",
      "Support Tir",
    ][index % 6],
    owner: names[(index + 1) % names.length],
    progress: Math.max(18, 82 - index * 9),
    due: `${index + 1}d`,
    construction: [
      "Stone Harbor",
      "Valkyrie Reach",
      "Aegis Terminal",
      "Northern Light",
    ][index % 4],
    commodity: [
      "Steel",
      "Power Generators",
      "CMM Composite",
      "Ceramic Composites",
    ][index % 4],
    delivered: 8200 - index * 540,
    required: 12000 - index * 300,
    population: 1_200_000_000 - index * 82_000_000,
    state: index % 2 ? "Boom" : "Expansion",
    power: index % 2 ? "Aisling Duval" : "Li Yong-Rui",
    conflicts: index % 3,
    influence: 48.2 - index * 2.1,
    change: Number((2.4 - index * 0.6).toFixed(1)),
    conflict: index % 3 === 0 ? "Election" : "None",
    timestamp: `2026-08-28T${String(18 - index).padStart(2, "0")}:24:00Z`,
    event: ["FSDJump", "MissionCompleted", "RedeemVoucher", "MarketSell"][
      index % 4
    ],
    source: index % 2 ? "EDDN" : "Journal",
    service: ["Flask API", "Dashboard BFF", "Discord Bot", "PostgreSQL"][
      index % 4
    ],
    action: [
      "health.check",
      "objective.create",
      "report.send",
      "cache.refresh",
    ][index % 4],
    actor: index % 2 ? names[index] : "system",
    correlation: `valk-${String(index + 1).padStart(5, "0")}`,
  };
}

export function mockPayload(feature: FeatureKey) {
  const rows = Array.from({ length: 8 }, (_, index) => baseRow(index));
  const metrics: Record<string, string | number> = {
    active: 42,
    profit: 184_200_000,
    topScore: 94,
    actions: 126,
    systems: 8,
    change: 18,
    new: 7,
    atRisk: 2,
    required: 42_000,
    population: 5_820_000_000,
    conflicts: 3,
    rows: 2_481_923,
    tables: 31,
    latest: "18:24",
    queryTime: 38,
    healthy: "4 / 4",
    version: "2.4.0",
    cache: 96,
    events: 184,
  };
  if (feature === "colonisation") {
    const constructions = [
      {
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
            unrecorded: 0,
            contributors: [
              { cmdr: "JanJonTheo", delivered: 40 },
              { cmdr: "Valkyrie", delivered: 30 },
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
      },
      {
        id: "84",
        construction: "Cook Vision",
        system: "Col 285 Sector OS-T d3-143",
        status: "finished",
        need: 60,
        delivered: 60,
        diff: 0,
        commodities: [
          {
            key: "steel",
            commodity: "Steel",
            need: 60,
            delivered: 60,
            diff: 0,
            unrecorded: 0,
            contributors: [{ cmdr: "Valkyrie", delivered: 60 }],
          },
        ],
      },
    ];
    const contributionRecords = [
      {
        id: "101-aluminium-0",
        eventId: "101",
        timestamp: "2026-08-27T18:15:00Z",
        tickId: "demo-tick-a",
        tickTime: "2026-08-27T08:00:00Z",
        cmdr: "JanJonTheo",
        commodity: "Aluminium",
        commodityKey: "aluminium",
        delivered: 40,
        constructionId: "42",
        construction: "Ivaldi Foundry",
        system: "Synookoi",
        status: "open",
      },
      {
        id: "102-water-1",
        eventId: "102",
        timestamp: "2026-08-27T18:45:00Z",
        tickId: "demo-tick-a",
        tickTime: "2026-08-27T08:00:00Z",
        cmdr: "JanJonTheo",
        commodity: "Water",
        commodityKey: "water",
        delivered: 10,
        constructionId: "42",
        construction: "Ivaldi Foundry",
        system: "Synookoi",
        status: "open",
      },
      {
        id: "103-aluminium-2",
        eventId: "103",
        timestamp: "2026-08-28T09:10:00Z",
        tickId: "demo-tick-b",
        tickTime: "2026-08-28T08:00:00Z",
        cmdr: "Valkyrie",
        commodity: "Aluminium",
        commodityKey: "aluminium",
        delivered: 30,
        constructionId: "42",
        construction: "Ivaldi Foundry",
        system: "Synookoi",
        status: "open",
      },
      {
        id: "104-steel-3",
        eventId: "104",
        timestamp: "2026-08-28T11:30:00Z",
        tickId: "demo-tick-b",
        tickTime: "2026-08-28T08:00:00Z",
        cmdr: "Valkyrie",
        commodity: "Steel",
        commodityKey: "steel",
        delivered: 60,
        constructionId: "84",
        construction: "Cook Vision",
        system: "Col 285 Sector OS-T d3-143",
        status: "finished",
      },
    ];
    return {
      data: contributionRecords,
      metrics: {
        delivered: 140,
        required: 210,
        commanders: 2,
        constructions: 2,
      },
      generated_at: new Date().toISOString(),
      pagination: {
        page: 1,
        page_size: contributionRecords.length,
        total: contributionRecords.length,
      },
      meta: {
        constructions,
        contributionRecords,
        contributionGroups: [
          {
            id: "janjontheo",
            cmdr: "JanJonTheo",
            delivered: 50,
            events: 2,
            commodities: [
              {
                key: "aluminium",
                commodity: "Aluminium",
                delivered: 40,
                events: 1,
              },
              {
                key: "water",
                commodity: "Water",
                delivered: 10,
                events: 1,
              },
            ],
            constructions: [
              {
                id: "42",
                construction: "Ivaldi Foundry",
                system: "Synookoi",
                status: "open",
                delivered: 50,
                events: 2,
                commodities: [
                  {
                    key: "aluminium",
                    commodity: "Aluminium",
                    delivered: 40,
                    events: 1,
                  },
                  {
                    key: "water",
                    commodity: "Water",
                    delivered: 10,
                    events: 1,
                  },
                ],
              },
            ],
          },
          {
            id: "valkyrie",
            cmdr: "Valkyrie",
            delivered: 90,
            events: 2,
            commodities: [
              {
                key: "aluminium",
                commodity: "Aluminium",
                delivered: 30,
                events: 1,
              },
              {
                key: "steel",
                commodity: "Steel",
                delivered: 60,
                events: 1,
              },
            ],
            constructions: [
              {
                id: "42",
                construction: "Ivaldi Foundry",
                system: "Synookoi",
                status: "open",
                delivered: 30,
                events: 1,
                commodities: [
                  {
                    key: "aluminium",
                    commodity: "Aluminium",
                    delivered: 30,
                    events: 1,
                  },
                ],
              },
              {
                id: "84",
                construction: "Cook Vision",
                system: "Col 285 Sector OS-T d3-143",
                status: "finished",
                delivered: 60,
                events: 1,
                commodities: [
                  {
                    key: "steel",
                    commodity: "Steel",
                    delivered: 60,
                    events: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    };
  }
  if (feature === "data-explorer")
    rows.forEach((row, index) =>
      Object.assign(row, {
        id: 2481923 - index,
        starsystem: row.system,
        systemaddress: 46_148_165_328_359 + index,
        tickid: `zoy-demo-tick-${index % 2 ? "a" : "b"}`,
        processed: true,
        raw_json: JSON.stringify({
          timestamp: row.timestamp,
          event: row.event,
          Commander: row.cmdr,
          StarSystem: row.system,
          StarPos: [613.09375 + index, 31.28125, 159.875],
          Docked: false,
          StationFaction: { Name: row.faction },
        }),
      }),
    );
  return {
    data: rows,
    metrics,
    generated_at: new Date().toISOString(),
    pagination: { page: 1, page_size: 25, total: rows.length },
  };
}

import { describe, expect, it } from "vitest";
import {
  assignFactionColours,
  calculateWatchlistStatistics,
  emptyWatchlistFilters,
  hasTenantFaction,
  matchesWatchlistFilters,
  normalizeWatchedSystems,
  prioritizeFavoriteSystems,
  sortWatchlistEntries,
  systemWatchlistSchema,
} from "@/lib/system-watchlist";

describe("system watchlist", () => {
  it("keeps the tenant metadata and rejects duplicate systems", () => {
    const valid = systemWatchlistSchema.parse({
      systems: [
        { system: "HIP 91987", sector: "VELA", projectName: "Velaris" },
      ],
    });
    expect(valid.systems[0]).toEqual({
      system: "HIP 91987",
      sector: "VELA",
      projectName: "Velaris",
      favorite: false,
    });
    expect(
      systemWatchlistSchema.safeParse({
        systems: [{ system: "HIP 91987" }, { system: "hip 91987" }],
      }).success,
    ).toBe(false);
  });

  it("normalizes current faction data and influence snapshots", () => {
    const result = normalizeWatchedSystems({
      data: [
        {
          requested_system: "HIP 91987",
          available: true,
          system_info: {
            system_name: "HIP 91987",
            controlling_faction: "Ukrainian Pilots Federation",
            allegiance: "Independent",
            government: "$government_Corporate;",
            economy: "$economy_Refinery;",
            security: "$SYSTEM_SECURITY_high;",
            population: 515330,
            updated_at: "2026-08-28T10:00:00Z",
          },
          factions: [
            {
              name: "East India Company",
              government: "$government_Corporate;",
              allegiance: "Empire",
              pending_states: '[{"State":"Expansion"}]',
              active_states: "[]",
              influence: 0.2428,
              updated_at: "2026-08-28T10:00:00Z",
            },
          ],
          history: [
            {
              ticktime: "2026-08-27T10:00:00Z",
              factions: [{ name: "East India Company", influence: 0.23 }],
            },
          ],
          conflicts: [
            {
              faction1: "East India Company",
              faction2: "Black Omega",
              status: "active",
              war_type: "War",
            },
          ],
          powerplays: [{ power: '["Aisling Duval"]' }],
        },
      ],
    });

    expect(result[0]).toMatchObject({
      name: "HIP 91987",
      government: "Corporate",
      economy: "Refinery",
      population: 515330,
      security: "High",
      powerplayPowers: ["Aisling Duval"],
    });
    expect(result[0].factions[0]).toMatchObject({
      name: "East India Company",
      allegiance: "Empire",
      pendingStates: ["Expansion"],
      influence: 24.28,
    });
    expect(result[0].factions[0].history).toHaveLength(2);
    expect(result[0].conflicts).toEqual([
      {
        faction1: "East India Company",
        faction2: "Black Omega",
        status: "Active",
        type: "War",
      },
    ]);
  });

  it("keeps allegiance metadata across upstream field variants and gaps", () => {
    const result = normalizeWatchedSystems({
      data: [
        {
          requested_system: "Alpha",
          available: true,
          system_info: {
            system_name: "Alpha",
            controlling_faction: "Shared Faction",
            allegiance: "Empire",
          },
          factions: [
            {
              Name: "Shared Faction",
              Allegiance: "$factionallegiance_Empire;",
              Government: "$government_Corporate;",
              Influence: 0.51,
            },
          ],
        },
        {
          requested_system: "Beta",
          available: true,
          system_info: { system_name: "Beta" },
          factions: [{ name: "Shared Faction", influence: 0.2 }],
        },
        {
          requested_system: "Gamma",
          available: true,
          system_info: {
            system_name: "Gamma",
            controlling_faction: "Local Controller",
            allegiance: "Federation",
          },
          factions: [{ name: "Local Controller", influence: 0.4 }],
        },
      ],
    });

    expect(result[0].factions[0]).toMatchObject({
      allegiance: "Empire",
      government: "Corporate",
    });
    expect(result[1].factions[0]).toMatchObject({
      allegiance: "Empire",
      government: "Corporate",
    });
    expect(result[2].factions[0].allegiance).toBe("Federation");
  });

  it("prioritizes favorites and recognizes the tenant faction", () => {
    const systems = systemWatchlistSchema.parse({
      systems: [
        { system: "Alpha", favorite: false },
        { system: "Beta", favorite: true },
        { system: "Gamma", favorite: true },
      ],
    }).systems;

    expect(
      prioritizeFavoriteSystems(systems).map((entry) => entry.system),
    ).toEqual(["Beta", "Gamma", "Alpha"]);
    const [watched] = normalizeWatchedSystems({
      data: [
        {
          requested_system: "Beta",
          available: true,
          system_info: { system_name: "Beta" },
          factions: [{ name: "East India Company" }],
        },
      ],
    });
    expect(hasTenantFaction(watched, "east india company")).toBe(true);
    expect(hasTenantFaction(watched, "East India Company Executive")).toBe(
      true,
    );
  });

  it("sorts watchlist fields while keeping favorites first", () => {
    const entries = systemWatchlistSchema.parse({
      systems: [
        { system: "Gamma", sector: "Zulu", projectName: "Third" },
        { system: "Alpha", sector: "Beta", projectName: "First" },
        {
          system: "Beta",
          sector: "Alpha",
          projectName: "Second",
          favorite: true,
        },
      ],
    }).systems;
    const systems = normalizeWatchedSystems({
      data: [
        {
          requested_system: "Gamma",
          available: true,
          system_info: {
            system_name: "Gamma",
            population: 100,
            government: "$government_Democracy;",
          },
        },
        {
          requested_system: "Alpha",
          available: true,
          system_info: {
            system_name: "Alpha",
            population: 300,
            government: "$government_Corporate;",
          },
        },
        {
          requested_system: "Beta",
          available: true,
          system_info: {
            system_name: "Beta",
            population: 200,
            government: "$government_Patronage;",
          },
        },
      ],
    });

    expect(
      sortWatchlistEntries(entries, systems, "system").map(
        (entry) => entry.system,
      ),
    ).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(
      sortWatchlistEntries(entries, systems, "sector", true).map(
        (entry) => entry.system,
      ),
    ).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(
      sortWatchlistEntries(entries, systems, "population", true).map(
        (entry) => entry.system,
      ),
    ).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(
      sortWatchlistEntries(entries, systems, "government").map(
        (entry) => entry.system,
      ),
    ).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("filters system facts with inclusive population and date ranges", () => {
    const entry = systemWatchlistSchema.parse({
      systems: [
        { system: "HIP 41318", sector: "VELA", projectName: "Velaris" },
      ],
    }).systems[0];
    const [system] = normalizeWatchedSystems({
      data: [
        {
          requested_system: "HIP 41318",
          available: true,
          system_info: {
            system_name: "HIP 41318",
            controlling_faction: "East India Company",
            population: 6_800_000_000,
            allegiance: "Empire",
            government: "$government_Corporate;",
            updated_at: "2026-08-29T13:14:00Z",
          },
        },
      ],
    });

    expect(
      matchesWatchlistFilters(entry, system, {
        ...emptyWatchlistFilters,
        system: "velar",
        controllingFaction: "india",
        populationMin: "6800000000",
        populationMax: "6800000000",
        updatedFrom: "2026-08-29",
        updatedTo: "2026-08-29",
        allegiance: "Empire",
        government: "Corporate",
        sector: "VELA",
      }),
    ).toBe(true);
    expect(
      matchesWatchlistFilters(entry, system, {
        ...emptyWatchlistFilters,
        populationMin: "6800000001",
      }),
    ).toBe(false);
    expect(
      matchesWatchlistFilters(entry, system, {
        ...emptyWatchlistFilters,
        updatedTo: "2026-08-28",
      }),
    ).toBe(false);
    expect(
      matchesWatchlistFilters(entry, system, {
        ...emptyWatchlistFilters,
        government: "Democracy",
      }),
    ).toBe(false);
  });

  it("assigns stable and unique colours to every faction in a system", () => {
    const factions = [
      { name: "East India Company" },
      { name: "Exphiay for Equality" },
      { name: "Gallant Investment Brokers" },
      { name: "The Consortium" },
    ];
    const colours = assignFactionColours(factions);
    const reversed = assignFactionColours([...factions].reverse());

    expect(new Set(colours.values()).size).toBe(factions.length);
    for (const faction of factions) {
      expect(colours.get(faction.name)).toBe(reversed.get(faction.name));
    }
  });

  it("aggregates watchlist statistics across available systems", () => {
    const systems = normalizeWatchedSystems({
      data: [
        {
          requested_system: "Alpha",
          available: true,
          system_info: {
            system_name: "Alpha",
            population: 100,
            security: "$SYSTEM_SECURITY_high;",
            allegiance: "Empire",
          },
          powerplays: [{ power: '["Aisling Duval"]' }],
        },
        {
          requested_system: "Beta",
          available: true,
          system_info: {
            system_name: "Beta",
            population: 250,
            security: "$SYSTEM_SECURITY_medium;",
            allegiance: "Independent",
          },
          powerplays: [],
        },
        {
          requested_system: "Missing",
          available: false,
          system_info: { system_name: "Missing" },
        },
      ],
    });
    const statistics = calculateWatchlistStatistics(systems, 3, {
      dodec: 2,
      orbis: 4,
      ocellus: 1,
      coriolis: 7,
      cachedSystems: 2,
      requestedSystems: 3,
    });

    expect(statistics).toMatchObject({
      systemCount: 3,
      availableCount: 2,
      totalPopulation: 350,
      largestPopulationSystem: { name: "Beta", population: 250 },
    });
    expect(statistics.security).toEqual([
      { label: "High", count: 1 },
      { label: "Medium", count: 1 },
      { label: "Low", count: 0 },
    ]);
    expect(statistics.allegiance).toEqual([
      { label: "Empire", count: 1 },
      { label: "Federation", count: 0 },
      { label: "Independent", count: 1 },
      { label: "Alliance", count: 0 },
    ]);
    expect(statistics.powerplay).toEqual([
      { label: "Aisling Duval", count: 1 },
      { label: "No power assigned", count: 1 },
    ]);
    expect(statistics.facilities).toEqual([
      { label: "Dodecs", count: 2 },
      { label: "Orbis", count: 4 },
      { label: "Ocellus", count: 1 },
      { label: "Coriolis", count: 7 },
    ]);
    expect(statistics.facilityCachedSystems).toBe(2);
  });
});

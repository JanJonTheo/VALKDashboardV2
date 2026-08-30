import { describe, expect, it } from "vitest";
import {
  filterAndSortGlobalSystems,
  globalWatchlistPageSize,
  globalWatchlistQuerySchema,
  type GlobalSystemIndexRow,
} from "@/lib/global-system-watchlist";

const rows: GlobalSystemIndexRow[] = [
  {
    system_name: "Alpha",
    population: 100,
    updated_at: "2026-08-29T10:00:00Z",
    controlling_faction: "Controller A",
    allegiance: "Empire",
    government: "$government_Corporate;",
  },
  {
    system_name: "Beta",
    population: 300,
    updated_at: "2026-08-30T10:00:00Z",
    controlling_faction: "Controller B",
    allegiance: "Independent",
    government: "$government_Democracy;",
  },
  {
    system_name: "No metadata",
    population: null,
    updated_at: "",
    controlling_faction: "",
    allegiance: "",
    government: "",
  },
];

describe("global system watchlist query", () => {
  it("uses stable defaults and rejects invalid ranges", () => {
    expect(globalWatchlistQuerySchema.parse({})).toMatchObject({
      page: 1,
      sort: "system",
      direction: "asc",
    });
    expect(
      globalWatchlistQuerySchema.safeParse({
        population_min: "200",
        population_max: "100",
      }).success,
    ).toBe(false);
    expect(
      globalWatchlistQuerySchema.safeParse({
        updated_from: "2026-08-30",
        updated_to: "2026-08-29",
      }).success,
    ).toBe(false);
    expect(
      globalWatchlistQuerySchema.safeParse({ sort: "drop table" }).success,
    ).toBe(false);
  });

  it("filters all requested system fields", () => {
    const query = globalWatchlistQuerySchema.parse({
      system: "alp",
      controlling_faction: "controller a",
      population_min: "100",
      population_max: "100",
      updated_from: "2026-08-29",
      updated_to: "2026-08-29",
      allegiance: "Empire",
      government: "$government_Corporate;",
    });
    expect(
      filterAndSortGlobalSystems([...rows], query).map(
        (row) => row.system_name,
      ),
    ).toEqual(["Alpha"]);
  });

  it("sorts deterministically and keeps missing values last", () => {
    expect(globalWatchlistPageSize).toBe(25);
    expect(
      filterAndSortGlobalSystems(
        [...rows],
        globalWatchlistQuerySchema.parse({
          sort: "population",
          direction: "desc",
        }),
      ).map((row) => row.system_name),
    ).toEqual(["Beta", "Alpha", "No metadata"]);
    expect(
      filterAndSortGlobalSystems(
        [...rows],
        globalWatchlistQuerySchema.parse({
          sort: "government",
          direction: "asc",
        }),
      ).map((row) => row.system_name),
    ).toEqual(["Alpha", "Beta", "No metadata"]);
  });
});

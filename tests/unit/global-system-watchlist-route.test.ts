import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databasePath: "",
  prepared: [] as { sql: string; parameters: unknown[] }[],
  closed: false,
  requireDashboardSession: vi.fn(),
  getTenantById: vi.fn(),
  flaskRequest: vi.fn(),
  labels: new Map(),
  systemNames: ["Alpha", "Beta"],
}));

vi.mock("better-sqlite3", () => ({
  default: class FakeDatabase {
    constructor(path: string, options: { readonly: boolean }) {
      mocks.databasePath = path;
      expect(options).toEqual({ readonly: true });
    }

    pragma() {}

    prepare(sql: string) {
      return {
        all: (...parameters: unknown[]) => {
          mocks.prepared.push({ sql, parameters });
          if (sql.startsWith("SELECT DISTINCT system_name FROM eddn_faction"))
            return mocks.systemNames.map((system_name) => ({ system_name }));
          return [
            {
              system_name: "Beta",
              population: 200,
              updated_at: "2026-08-30T00:00:00Z",
              controlling_faction: "Controller B",
              allegiance: "Independent",
              government: "$government_Democracy;",
            },
            {
              system_name: "Alpha",
              population: 100,
              updated_at: "2026-08-29T00:00:00Z",
              controlling_faction: "Controller A",
              allegiance: "Empire",
              government: "$government_Corporate;",
            },
          ];
        },
      };
    }

    close() {
      mocks.closed = true;
    }
  },
}));

vi.mock("@/lib/session", () => ({
  AccessError: class AccessError extends Error {
    status = 401;
  },
  requireDashboardSession: mocks.requireDashboardSession,
}));
vi.mock("@/lib/tenant-config", () => ({
  getTenantById: mocks.getTenantById,
}));
vi.mock("@/lib/flask", () => ({
  flaskRequest: mocks.flaskRequest,
}));

import { GET } from "@/app/api/system-watchlist/global/route";
vi.mock("@/lib/watchlist-labels-store", () => ({
  loadWatchlistLabels: async () => mocks.labels,
}));

describe("global system watchlist route", () => {
  beforeEach(() => {
    mocks.labels = new Map();
    mocks.systemNames = ["Alpha", "Beta"];
    process.env.VALK_EDDN_DATABASE = resolve("shared/bgs_data_eddn.db");
    mocks.databasePath = "";
    mocks.prepared.length = 0;
    mocks.closed = false;
    mocks.requireDashboardSession.mockReset().mockResolvedValue({
      tenant: { id: "tenant-1" },
    });
    mocks.getTenantById.mockReset().mockResolvedValue({
      databasePath: "C:/tenant/eddn.db",
      factionName: "East India Company",
    });
    mocks.flaskRequest
      .mockReset()
      .mockImplementation(async (_path: string, request: Request) =>
        Response.json({
          data: [
            {
              requested_system: "Beta",
              system_info: { system_name: "Beta" },
            },
            {
              requested_system: "Alpha",
              system_info: { system_name: "Alpha" },
            },
          ],
          generated_at: "2026-08-30T00:00:00Z",
          request_body: await request.clone().json(),
        }),
      );
  });

  it("derives tenant faction server-side and restores the paged order", async () => {
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/global?page=1&sort=system&faction=Attacker",
      ),
    );
    const payload = (await response.json()) as {
      data: { requested_system: string }[];
      pagination: { page: number; page_size: number; total: number };
      filter_options: {
        allegiances: { value: string; label: string }[];
        governments: { value: string; label: string }[];
      };
    };

    expect(response.status).toBe(200);
    expect(mocks.requireDashboardSession).toHaveBeenCalledOnce();
    expect(mocks.getTenantById).toHaveBeenCalledWith("tenant-1");
    expect(mocks.databasePath).toBe(process.env.VALK_EDDN_DATABASE);
    expect(mocks.closed).toBe(true);
    expect(
      mocks.prepared.some(({ parameters }) =>
        parameters.includes("East India Company"),
      ),
    ).toBe(true);
    expect(
      mocks.prepared.some(({ parameters }) => parameters.includes("Attacker")),
    ).toBe(false);
    expect(payload.data.map((item) => item.requested_system)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(payload.pagination).toEqual({
      page: 1,
      page_size: 25,
      total: 2,
    });
    expect(payload.filter_options).toEqual({
      sectors: [],
      projects: [],
      allegiances: [
        { value: "Empire", label: "Empire" },
        { value: "Independent", label: "Independent" },
      ],
      governments: [
        { value: "$government_Corporate;", label: "Corporate" },
        { value: "$government_Democracy;", label: "Democracy" },
      ],
    });
    const upstreamRequest = mocks.flaskRequest.mock.calls[0]?.[1] as Request;
    await expect(upstreamRequest.clone().json()).resolves.toEqual({
      systems: ["Alpha", "Beta"],
      history_days: 7,
    });
  });

  it("rejects unsupported sort fields before opening tenant data", async () => {
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/global?sort=population%3BDROP%20TABLE",
      ),
    );
    expect(response.status).toBe(400);
    expect(mocks.requireDashboardSession).not.toHaveBeenCalled();
    expect(mocks.databasePath).toBe("");
  });

  it("aggregates the complete global list in bounded batches regardless of page and filters", async () => {
    mocks.systemNames = Array.from({ length: 108 }, (_, i) => `System ${i}`);
    mocks.flaskRequest.mockImplementation(
      async (_path: string, request: Request) => {
        const { systems } = await request.clone().json();
        return Response.json({
          data: systems.map((name: string) => ({
            requested_system: name,
            available: true,
            system_info: { system_name: name, population: 10 },
          })),
          facility_statistics: {
            types: { coriolis: systems.length },
            cached_systems: systems.length,
          },
        });
      },
    );
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/global?statistics=true&page=4&sector=Missing",
      ),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.statistics).toMatchObject({
      systemCount: 108,
      availableCount: 108,
      totalPopulation: 1080,
      facilityCachedSystems: 108,
    });
    expect(payload.statistics.facilities).toContainEqual({
      label: "Coriolis",
      count: 108,
    });
    expect(mocks.flaskRequest).toHaveBeenCalledTimes(2);
    const sizes = await Promise.all(
      mocks.flaskRequest.mock.calls.map(
        async ([, request]) => (await request.clone().json()).systems.length,
      ),
    );
    expect(sizes).toEqual([100, 8]);
  });

  it("returns upstream failures instead of partial statistics", async () => {
    mocks.flaskRequest.mockResolvedValue(
      Response.json({ error: { message: "Unavailable" } }, { status: 503 }),
    );
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/global?statistics=true",
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("statistics");
  });

  it("filters labels across the complete index before pagination", async () => {
    mocks.systemNames = [
      ...Array.from({ length: 30 }, (_, i) => `Alpha ${i}`),
      "Zeta",
    ];
    mocks.labels.set("zeta", {
      system: "Zeta",
      sector: "Outer Rim",
      projectName: "Harbor",
    });
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/global?sector=Outer%20Rim&project_name=Harbor",
      ),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.pagination.total).toBe(1);
    expect(payload.data[0]).toMatchObject({
      requested_system: "Zeta",
      watchlist_labels: { sector: "Outer Rim", projectName: "Harbor" },
    });
    expect(payload.filter_options).toMatchObject({
      sectors: ["Outer Rim"],
      projects: ["Harbor"],
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  databasePath: "",
  prepared: [] as { sql: string; parameters: unknown[] }[],
  closed: false,
  requireDashboardSession: vi.fn(),
  flaskRequest: vi.fn(),
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
            return [
              { system_name: "Alpha" },
              { system_name: "alpha" },
              { system_name: "Beta" },
            ];
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
vi.mock("@/lib/flask", () => ({ flaskRequest: mocks.flaskRequest }));

import { GET } from "@/app/api/system-watchlist/protected/route";

describe("protected system watchlist route", () => {
  beforeEach(() => {
    process.env.VALK_EDDN_DATABASE = "C:/shared/bgs_data_eddn.db";
    mocks.databasePath = "";
    mocks.prepared.length = 0;
    mocks.closed = false;
    mocks.requireDashboardSession.mockReset().mockResolvedValue({
      tenant: { id: "tenant-1" },
    });
    mocks.flaskRequest.mockReset().mockImplementation(async (path: string) => {
      if (path === "protected-faction") {
        return Response.json({
          data: [
            {
              id: 8,
              name: "Zulu Guard",
              description: "Second",
              protected: true,
              webhook_url:
                "https://discord.com/api/webhooks/123456789/secret-token",
            },
            {
              id: 7,
              name: "Alpha Guard",
              description: "First",
              protected: true,
              webhook_url: "https://example.com/not-discord",
            },
            {
              id: 6,
              name: "Inactive Guard",
              protected: false,
              webhook_url:
                "https://discord.com/api/webhooks/123456789/other-secret",
            },
          ],
        });
      }
      return Response.json({
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
      });
    });
  });

  it("returns a deduplicated union and sanitized active faction choices", async () => {
    const response = await GET(
      new Request("https://dashboard.test/api/system-watchlist/protected"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.databasePath).toBe("C:/shared/bgs_data_eddn.db");
    expect(mocks.closed).toBe(true);
    expect(payload.pagination).toEqual({ page: 1, page_size: 25, total: 2 });
    expect(
      payload.data.map(
        (item: { requested_system: string }) => item.requested_system,
      ),
    ).toEqual(["Alpha", "Beta"]);
    expect(payload.protected_factions).toEqual([
      {
        id: 7,
        name: "Alpha Guard",
        description: "First",
        webhook_configured: false,
      },
      {
        id: 8,
        name: "Zulu Guard",
        description: "Second",
        webhook_configured: true,
      },
    ]);
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(JSON.stringify(payload)).not.toContain("other-secret");
    expect(
      mocks.prepared.some(
        ({ parameters }) =>
          parameters.includes("Alpha Guard") &&
          parameters.includes("Zulu Guard"),
      ),
    ).toBe(true);
  });

  it("rejects invalid faction ids before authentication", async () => {
    const response = await GET(
      new Request(
        "https://dashboard.test/api/system-watchlist/protected?protected_faction_id=oops",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.requireDashboardSession).not.toHaveBeenCalled();
  });
});

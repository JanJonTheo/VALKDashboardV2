import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  save: vi.fn(),
  flask: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireDashboardSession: mocks.session,
  AccessError: class AccessError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/watchlist-labels-store", () => ({
  saveWatchlistLabels: mocks.save,
}));
vi.mock("@/lib/flask", () => ({ flaskRequest: mocks.flask }));
import { AccessError } from "@/lib/session";
import { PUT } from "@/app/api/system-watchlist/labels/route";
import { GET } from "@/app/api/system-watchlist/spansh/route";
import { GET as detail } from "@/app/api/system-watchlist/detail/route";
import { POST as batchDetail } from "@/app/api/system-watchlist/detail/route";
import { POST as discord } from "@/app/api/bgs-alerts/[alertId]/discord/route";

describe("watchlist label and external link routes", () => {
  it("validates and deduplicates a batch, retaining session protection", async () => {
    mocks.flask.mockResolvedValue(Response.json({ data: [] }));
    const request = (systems: string[]) =>
      new Request("https://test/api/system-watchlist/detail?tenant=wrong", {
        method: "POST",
        body: JSON.stringify({ systems }),
      });
    expect((await batchDetail(request(["Sol", " sol "]))).status).toBe(200);
    expect(await (mocks.flask.mock.calls[0][1] as Request).json()).toEqual({
      systems: ["Sol"],
      history_days: 7,
    });
    expect((await batchDetail(request(Array(101).fill("Sol")))).status).toBe(
      400,
    );
    expect((await batchDetail(request([]))).status).toBe(400);
    mocks.session.mockRejectedValueOnce(
      new AccessError(401, "Authentication required"),
    );
    expect(await batchDetail(request(["Sol"]))).toHaveProperty("status", 401);
  });
  it("loads only the requested system and checks the Discord sending capability", async () => {
    mocks.session.mockResolvedValue({
      tenant: { id: "real-tenant" },
      user: { id: "2" },
    });
    mocks.flask.mockResolvedValue(Response.json({ data: [] }));
    expect(
      (
        await detail(
          new Request(
            "https://test/api/system-watchlist/detail?system=Sol&tenant=other",
          ),
        )
      ).status,
    ).toBe(200);
    const upstream = mocks.flask.mock.calls[0][1] as Request;
    expect(new URL(upstream.url).search).toBe("");
    expect(await upstream.json()).toEqual({
      systems: ["Sol"],
      history_days: 7,
    });
    expect(mocks.session).toHaveBeenCalledWith("dashboard:read");
    mocks.session.mockRejectedValue(new AccessError(403, "Forbidden"));
    expect(
      (
        await discord(
          new Request("https://test/api/bgs-alerts/id/discord", {
            method: "POST",
            body: "{}",
          }),
          { params: Promise.resolve({ alertId: "id" }) },
        )
      ).status,
    ).toBe(403);
    expect(mocks.session).toHaveBeenLastCalledWith("reports:send");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      tenant: { id: "real-tenant" },
      user: { id: "2" },
    });
    mocks.save.mockResolvedValue(undefined);
  });
  it("requires shared editing rights and derives tenant and actor from the session", async () => {
    const response = await PUT(
      new Request("https://test/api/system-watchlist/labels", {
        method: "PUT",
        body: JSON.stringify({
          system: " Alpha ",
          sector: " West ",
          projectName: "Harbor",
          tenant_id: "attacker",
          user_id: "999",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.session).toHaveBeenCalledWith("tenant-rules:write");
    expect(mocks.save).toHaveBeenCalledWith("real-tenant", "2", {
      system: "Alpha",
      sector: "West",
      projectName: "Harbor",
    });
  });
  it("rejects members and invalid or oversized labels without writing", async () => {
    mocks.session.mockRejectedValueOnce(new AccessError(403, "Forbidden"));
    expect(
      (
        await PUT(
          new Request("https://test/api/system-watchlist/labels", {
            method: "PUT",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await PUT(
          new Request("https://test/api/system-watchlist/labels", {
            method: "PUT",
            body: JSON.stringify({ system: "Alpha", sector: "x".repeat(81) }),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await PUT(
          new Request("https://test/api/system-watchlist/labels", {
            method: "PUT",
            body: "x".repeat(4097),
          }),
        )
      ).status,
    ).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("resolves Spansh through the system cache and rejects arbitrary redirects", async () => {
    mocks.flask.mockResolvedValueOnce(
      Response.json({
        data: { source_url: "https://spansh.co.uk/system/10477373803" },
      }),
    );
    const response = await GET(
      new Request("https://test/api/system-watchlist/spansh?system=Sol"),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://spansh.co.uk/system/10477373803",
    );
    mocks.flask.mockResolvedValueOnce(
      Response.json({ data: { source_url: "https://evil.test/" } }),
    );
    expect(
      (
        await GET(
          new Request("https://test/api/system-watchlist/spansh?system=Sol"),
        )
      ).status,
    ).toBe(404);
  });
});

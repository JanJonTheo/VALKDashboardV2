import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardSession: vi.fn(),
  flaskRequest: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  AccessError: class AccessError extends Error {
    status = 401;
  },
  requireDashboardSession: mocks.requireDashboardSession,
}));

vi.mock("@/lib/flask", () => ({
  flaskRequest: mocks.flaskRequest,
}));

import { GET, POST } from "@/app/api/bff/[feature]/route";

async function postDiscordReport(body: Record<string, unknown>) {
  return POST(
    new Request("https://dashboard.test/api/bff/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "discord-report", ...body }),
    }),
    { params: Promise.resolve({ feature: "evaluations" }) },
  );
}

async function lastUpstreamBody() {
  const request = mocks.flaskRequest.mock.calls.at(-1)?.[1] as Request;
  return request.clone().json();
}

describe("cancelled Data explorer scans", () => {
  it("forwards cancellation and stops scheduling subsequent pages", async () => {
    const controller = new AbortController();
    const request = new Request(
      "https://dashboard.test/api/bff/data-explorer?table=event&scope=all",
      { signal: controller.signal },
    );
    const previousBase = process.env.FLASK_API_BASE_URL;
    const previousDemo = process.env.VALK_DEMO_MODE;
    process.env.FLASK_API_BASE_URL = "https://flask.test/api/";
    process.env.VALK_DEMO_MODE = "false";
    mocks.requireDashboardSession.mockResolvedValue({
      tenant: { id: "tenant-1" },
    });
    mocks.flaskRequest
      .mockReset()
      .mockImplementation(async (_path, upstream: Request) => {
        expect(upstream.signal.aborted).toBe(false);
        controller.abort();
        expect(upstream.signal.aborted).toBe(true);
        return Response.json({
          data: [{ id: 1 }],
          pagination: { total: 2000 },
        });
      });
    try {
      const response = await GET(request, {
        params: Promise.resolve({ feature: "data-explorer" }),
      });
      expect(response.ok).toBe(false);
      expect(mocks.flaskRequest).toHaveBeenCalledTimes(1);
    } finally {
      if (previousBase === undefined) delete process.env.FLASK_API_BASE_URL;
      else process.env.FLASK_API_BASE_URL = previousBase;
      if (previousDemo === undefined) delete process.env.VALK_DEMO_MODE;
      else process.env.VALK_DEMO_MODE = previousDemo;
    }
  });
});

describe("feature BFF Discord reports", () => {
  beforeEach(() => {
    process.env.FLASK_API_BASE_URL = "https://flask.test/api/";
    process.env.VALK_DEMO_MODE = "false";
    mocks.requireDashboardSession.mockReset().mockResolvedValue({
      tenant: { id: "tenant-1" },
      user: { id: "user-1" },
      role: "admin",
    });
    mocks.flaskRequest
      .mockReset()
      .mockResolvedValue(Response.json({ ok: true }));
  });

  it("forwards the selected preset period and evaluation mode", async () => {
    const response = await postDiscordReport({ period: "cw", mode: "top5" });

    expect(response.status).toBe(200);
    expect(mocks.flaskRequest).toHaveBeenCalledWith(
      "summary/discord/report",
      expect.any(Request),
      expect.any(Object),
    );
    await expect(lastUpstreamBody()).resolves.toEqual({
      page: "evaluations",
      mode: "top5",
      period: "cw",
    });
  });

  it("loads the explorer catalog with one authorized upstream request", async () => {
    mocks.flaskRequest.mockResolvedValue(
      Response.json({
        data: [],
        pagination: { total: 47750 },
        meta: {
          columns: ["id", "cmdr"],
          filter_options: {
            cmdrs: ["Beta", "Alpha"],
            events: ["FSDJump"],
            tickids: ["2", "10"],
          },
        },
      }),
    );
    const response = await GET(
      new Request(
        "https://dashboard.test/api/bff/data-explorer?table=event&options=1",
      ),
      { params: Promise.resolve({ feature: "data-explorer" }) },
    );
    expect(mocks.requireDashboardSession).toHaveBeenCalledWith("admin:read");
    expect(mocks.flaskRequest).toHaveBeenCalledTimes(1);
    expect(
      new URL(mocks.flaskRequest.mock.calls[0][1].url).searchParams.get(
        "options",
      ),
    ).toBe("1");
    expect((await response.json()).meta.filter_options.cmdrs).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("forwards global search and paging without downloading all rows", async () => {
    mocks.flaskRequest.mockResolvedValue(
      Response.json({
        data: [{ id: 300 }],
        pagination: { page: 2, page_size: 25, total: 30 },
      }),
    );
    const response = await GET(
      new Request(
        "https://dashboard.test/api/bff/data-explorer?table=event&search=100%25_literal&page=2&page_size=25",
      ),
      { params: Promise.resolve({ feature: "data-explorer" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.flaskRequest).toHaveBeenCalledTimes(1);
    const params = new URL(mocks.flaskRequest.mock.calls[0][1].url)
      .searchParams;
    expect(params.get("search")).toBe("100%_literal");
    expect(params.get("page")).toBe("2");
  });

  it("forwards a selected custom date range", async () => {
    await postDiscordReport({
      period: "date-range",
      from_date: "2026-08-01",
      to_date: "2026-08-31",
    });

    await expect(lastUpstreamBody()).resolves.toEqual({
      page: "evaluations",
      mode: "full",
      from_date: "2026-08-01",
      to_date: "2026-08-31",
    });
  });

  it("converts a selected month range to Flask report parameters", async () => {
    await postDiscordReport({
      period: "month-range",
      from_month: "2026-06",
      to_month: "2026-08",
    });

    await expect(lastUpstreamBody()).resolves.toEqual({
      page: "evaluations",
      mode: "full",
      from_date: "2026-06-01",
      to_date: "2026-08-31",
      group_by: "month",
    });
  });

  it("does not silently send all-time data for an incomplete custom range", async () => {
    const response = await postDiscordReport({
      period: "date-range",
      from_date: "2026-08-01",
    });

    expect(response.status).toBe(400);
    expect(mocks.flaskRequest).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ACTION" },
    });
  });
});

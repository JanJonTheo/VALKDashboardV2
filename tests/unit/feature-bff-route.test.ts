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

import { POST } from "@/app/api/bff/[feature]/route";

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

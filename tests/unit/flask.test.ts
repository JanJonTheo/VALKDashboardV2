// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSession } from "@/lib/access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenant-config", () => ({
  getTenantById: vi
    .fn()
    .mockResolvedValue({ apiKey: "test-key", apiVersion: "1.8.0" }),
}));

import { flaskRequest } from "@/lib/flask";

const session: DashboardSession = {
  tenant: { id: "test-tenant", name: "Test tenant" },
  user: { id: "test-user", name: "Test user" },
  role: "member",
  capabilities: ["dashboard:read"],
  availableTenants: [],
  verifiedAt: "2026-09-27T00:00:00Z",
  mustChangePassword: false,
};

describe("Flask request lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("FLASK_API_BASE_URL", "https://flask.test/api/");
    vi.stubEnv("DASHBOARD_JWT_SECRET", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps the existing data envelope and reports upstream timing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json([{ id: 1 }])),
    );
    const response = await flaskRequest(
      "table/event",
      new Request("https://dashboard.test/api?page=2"),
      session,
    );
    expect(response.headers.get("server-timing")).toMatch(/^flask;dur=\d+$/);
    expect(await response.json()).toMatchObject({
      data: [{ id: 1 }],
      pagination: { page: 2 },
    });
  });

  it("does not contact Flask for an already cancelled request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      flaskRequest(
        "table/event",
        new Request("https://dashboard.test/api", {
          signal: controller.signal,
        }),
        session,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels an in-flight upstream fetch when the caller disconnects", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener(
              "abort",
              () => reject(options.signal!.reason),
              { once: true },
            );
            controller.abort();
          }),
      ),
    );
    await expect(
      flaskRequest(
        "table/event",
        new Request("https://dashboard.test/api", {
          signal: controller.signal,
        }),
        session,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not disguise a timeout while reading the body as a successful response", async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          timeout.abort(new DOMException("Upstream timed out", "TimeoutError"));
          throw timeout.signal.reason;
        },
      }),
    );
    await expect(
      flaskRequest(
        "table/event",
        new Request("https://dashboard.test/api"),
        session,
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("rejects malformed JSON instead of returning a successful empty dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>gateway error</html>")),
    );
    await expect(
      flaskRequest(
        "table/event",
        new Request("https://dashboard.test/api"),
        session,
      ),
    ).rejects.toThrow("Invalid JSON response from Flask");
  });
});

// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenant-config", () => ({ getTenantById: vi.fn().mockResolvedValue({ id: "test" }) }));
vi.mock("@/lib/session", () => ({
  AccessError: class extends Error { status = 401; },
  requireDashboardSession: vi.fn().mockResolvedValue({
    tenant: { id: "test" }, user: { id: "test-user" }, sessionId: "test-session",
    role: "member", capabilities: ["dashboard:read"],
  }),
}));

import { POST } from "@/app/api/remote-screen/[...path]/route";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("forwards a public HTTPS pairing request once under the configured Flask API prefix", async () => {
  vi.stubEnv("VALK_PUBLIC_URL", "https://valk.test");
  vi.stubEnv("FLASK_API_BASE_URL", "http://127.0.0.1:5000/api/");
  vi.stubEnv("DASHBOARD_JWT_SECRET", "test-signing-secret");
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: "single-use-code" }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(new Request("http://localhost:8889/api/remote-screen/pairings", {
    method: "POST", headers: { origin: "https://valk.test" },
  }), { params: Promise.resolve({ path: ["pairings"] }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ code: "single-use-code" });
  expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:5000/api/remote-screen/v1/pairings");
  expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toMatch(/^Bearer /);
});

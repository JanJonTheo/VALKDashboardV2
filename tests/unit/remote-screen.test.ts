import { afterEach, describe, expect, it, vi } from "vitest";
import { videoPoint } from "@/lib/remote-screen";
const mocks = vi.hoisted(() => ({ proxy: vi.fn() }));
vi.mock("@/lib/route-proxy", () => ({ proxyDashboardRoute: mocks.proxy }));
import { GET, POST, PUT } from "@/app/api/remote-screen/[...path]/route";

describe("remote screen boundary", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("accepts the configured HTTPS origin behind an HTTP proxy", async () => {
    vi.stubEnv("VALK_PUBLIC_URL", "https://valk.test");
    vi.stubEnv("DASHBOARD_JWT_SECRET", "test");
    mocks.proxy.mockResolvedValue(Response.json({ code: "test-code" }));
    const request = new Request("http://localhost:8889/api/remote-screen/pairings", {
      method: "POST", headers: { origin: "https://valk.test" },
    });
    const response = await POST(request, { params: Promise.resolve({ path: ["pairings"] }) });
    expect(response.status).toBe(200);
    expect(mocks.proxy).toHaveBeenCalledWith(request, "remote-screen/v1/pairings");
  });
  it("rejects missing or spoofed origins despite forwarded headers", async () => {
    vi.stubEnv("VALK_PUBLIC_URL", "https://valk.test");
    for (const origin of [undefined, "http://localhost:8889", "https://evil.test"]) {
      const headers: Record<string, string> = { "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" };
      if (origin) headers.origin = origin;
      const response = await POST(new Request("http://localhost:8889/api/remote-screen/pairings", {
        method: "POST", headers,
      }), { params: Promise.resolve({ path: ["pairings"] }) });
      expect(response.status).toBe(403);
      expect(mocks.proxy).not.toHaveBeenCalled();
    }
  });
  it("maps ultrawide letterboxing and rejects clicks outside the actual picture", () => {
    const rect = { left: 10, top: 10, width: 1000, height: 600 };
    expect(videoPoint(rect, 3840, 1600, 510, 310)).toEqual({ x: 0.5, y: 0.5 });
    expect(videoPoint(rect, 3840, 1600, 510, 20)).toBeNull();
    expect(videoPoint(rect, 0, 0, 510, 310)).toBeNull();
  });
  it("never exposes device-auth or pairing-redemption routes through the user BFF", async () => {
    for (const path of [["device", "pulse"], ["pair"], ["..", "users"]]) {
      const response = await POST(new Request("https://valk.test/api/remote-screen/x", { method: "POST" }), { params: Promise.resolve({ path }) });
      expect(response.status).toBe(404);
    }
  });
  it("rejects cross-origin mutations before forwarding", async () => {
    const response = await PUT(new Request("https://valk.test/api/remote-screen/x", {
      method: "PUT", headers: { origin: "https://other.test" },
    }), { params: Promise.resolve({ path: ["devices", "a".repeat(32), "grants"] }) });
    expect(response.status).toBe(403);
  });
  it("requires bearer configuration; no legacy API key fallback", async () => {
    vi.stubEnv("DASHBOARD_JWT_SECRET", "");
    const response = await GET(new Request("https://valk.test/api/remote-screen/devices"), { params: Promise.resolve({ path: ["devices"] }) });
    expect(response.status).toBe(503);
    vi.unstubAllEnvs();
  });
  it("uses the authenticated proxy for allowed paths", async () => {
    vi.stubEnv("DASHBOARD_JWT_SECRET", "test");
    mocks.proxy.mockResolvedValue(Response.json({ devices: [] }));
    const request = new Request("https://valk.test/api/remote-screen/devices");
    await GET(request, { params: Promise.resolve({ path: ["devices"] }) });
    expect(mocks.proxy).toHaveBeenCalledWith(request, "remote-screen/v1/devices");
    vi.unstubAllEnvs();
  });
});

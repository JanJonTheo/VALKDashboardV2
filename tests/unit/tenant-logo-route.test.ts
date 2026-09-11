import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  session: vi.fn(),
  tenant: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, default: { readFile: mocks.readFile } }));
vi.mock("@/lib/session", () => ({
  requireDashboardSession: mocks.session,
  AccessError: class extends Error {
    status = 401;
  },
}));
vi.mock("@/lib/tenant-config", () => ({
  configuredTenantFilePath: () => "/config/tenant.json",
  getTenantById: mocks.tenant,
}));
import { GET } from "@/app/api/tenant-logo/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ tenant: { id: "eic" } });
  mocks.tenant.mockResolvedValue({ factionLogo: "/assets/eic.png" });
  mocks.readFile.mockResolvedValue(Buffer.from("logo"));
});

it("serves the session tenant logo without cross-session caching", async () => {
  const response = await GET();
  expect(mocks.tenant).toHaveBeenCalledWith("eic");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.text()).toBe("logo");
});

it("returns not found when the configured image is missing", async () => {
  mocks.readFile.mockRejectedValue(new Error("missing"));
  expect((await GET()).status).toBe(404);
});

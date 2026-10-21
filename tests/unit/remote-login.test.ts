import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  redirect: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/lib/better-auth", () => ({
  socialAuthConfigured: () => true,
  getTenantAuth: async () => ({
    api: {
      getSession: async () => ({
        user: { id: "1", name: "Commander", role: "member", active: true },
        session: { id: "session" },
      }),
    },
  }),
}));
vi.mock("@/lib/tenant-config", () => ({
  getTenantById: async () => ({ id: "tenant" }),
}));
vi.mock("@/lib/session", () => ({
  getDashboardSession: mocks.session,
  createSessionToken: mocks.token,
  SESSION_COOKIE: "session",
  sessionCookieOptions: () => ({ httpOnly: true }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/public-app-url", () => ({
  publicAppUrl: (path: string) => new URL(path, "https://valk.test"),
}));
import { GET } from "@/app/api/session/social-complete/route";
import MobileRemotePage from "@/app/remote/page";

afterEach(() => vi.resetAllMocks());

it.each([
  ["/remote", "/remote"],
  ["https://evil.test", "/"],
  ["//evil.test", "/"],
  ["/admin/users", "/"],
])(
  "only accepts the known mobile destination after social login: %s",
  async (next, expected) => {
    mocks.token.mockResolvedValue("signed-token");
    const response = await GET(
      new Request(
        `https://valk.test/api/session/social-complete?tenantId=tenant&next=${encodeURIComponent(next)}`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      `https://valk.test${expected}`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  },
);

it("requires login before rendering the mobile client", async () => {
  mocks.session.mockResolvedValue(null);
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirected");
  });
  await expect(MobileRemotePage()).rejects.toThrow("redirected");
  expect(mocks.redirect).toHaveBeenCalledWith("/sign-in?next=/remote");
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { upstream, session } = vi.hoisted(() => ({
  upstream: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/flask", () => ({ flaskRequest: upstream }));
vi.mock("@/lib/session", () => ({
  requireDashboardSession: session,
  AccessError: class extends Error {},
}));
import { PUT } from "@/app/api/preferences/[viewKey]/route";

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/preferences/test", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ viewKey: "test" }) },
  );
}

describe("preference storage limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.mockResolvedValue({ userId: "test" });
    upstream.mockResolvedValue(new Response('{"ok":true}'));
  });

  it("forwards collections using schema version 5", async () => {
    const current = {
      filters: {},
      sorting: [],
      visibleColumns: [],
      pageSize: 25,
    };
    const response = await put({ current, activeViewId: null, views: [] });
    expect(response.status).toBe(200);
    expect(await upstream.mock.calls[0][1].json()).toEqual({
      schema_version: 5,
      payload: { current, activeViewId: null, views: [] },
    });
  });

  it("rejects a body exceeding the live Flask limit", async () => {
    const response = await put({ filters: { oversized: "x".repeat(16384) } });
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("also counts UTF-8 bytes and the upstream envelope", async () => {
    const body = {
      filters: {
        values: Array.from({ length: 31 }, () => "é".repeat(256)),
        tail: "",
      },
      sorting: [],
      visibleColumns: [],
      pageSize: 25,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
    body.filters.tail = "x".repeat(16384 - bytes - 10);
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(
      16384,
    );
    const response = await put(body);
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});

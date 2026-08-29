import { afterEach, describe, expect, it } from "vitest";
import { isAllowedRequestOrigin } from "@/lib/request-origin";

const originalPublicUrl = process.env.VALK_PUBLIC_URL;

afterEach(() => {
  if (originalPublicUrl === undefined) delete process.env.VALK_PUBLIC_URL;
  else process.env.VALK_PUBLIC_URL = originalPublicUrl;
});

describe("isAllowedRequestOrigin", () => {
  it("accepts the public host even when Next uses an internal request hostname", () => {
    delete process.env.VALK_PUBLIC_URL;
    const request = new Request("http://0.0.0.0:8889/api/session/login", { headers: { host: "167.235.65.113:8889", origin: "http://167.235.65.113:8889" } });
    expect(isAllowedRequestOrigin(request)).toBe(true);
  });

  it("accepts the explicitly configured public origin behind a proxy", () => {
    process.env.VALK_PUBLIC_URL = "https://dashboard.example.org";
    const request = new Request("http://127.0.0.1:8889/api/session/login", { headers: { host: "127.0.0.1:8889", origin: "https://dashboard.example.org" } });
    expect(isAllowedRequestOrigin(request)).toBe(true);
  });

  it("rejects a foreign origin", () => {
    process.env.VALK_PUBLIC_URL = "http://167.235.65.113:8889";
    const request = new Request("http://0.0.0.0:8889/api/session/login", { headers: { host: "167.235.65.113:8889", origin: "https://attacker.example" } });
    expect(isAllowedRequestOrigin(request)).toBe(false);
  });
});

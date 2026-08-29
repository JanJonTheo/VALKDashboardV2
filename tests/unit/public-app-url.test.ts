import { describe, expect, it } from "vitest";
import { normalizedOAuthLocation, publicAppUrl } from "@/lib/public-app-url";

const requestUrl =
  "https://localhost:8889/api/auth/valk-development/callback/discord";
const publicUrl = "https://valk-elite.de";

describe("public application OAuth URLs", () => {
  it("builds application redirects from the configured public origin", () => {
    expect(publicAppUrl("/", requestUrl, publicUrl).toString()).toBe(
      "https://valk-elite.de/",
    );
  });

  it("rewrites loopback and relative callback locations", () => {
    expect(
      normalizedOAuthLocation(
        "https://localhost:8889/account?linked=discord",
        requestUrl,
        publicUrl,
      ).toString(),
    ).toBe("https://valk-elite.de/account?linked=discord");
    expect(
      normalizedOAuthLocation("/account", requestUrl, publicUrl).toString(),
    ).toBe("https://valk-elite.de/account");
  });

  it("keeps external provider redirects unchanged", () => {
    const discord = "https://discord.com/oauth2/authorize?client_id=test";
    expect(
      normalizedOAuthLocation(discord, requestUrl, publicUrl).toString(),
    ).toBe(discord);
  });
});

import { describe, expect, it } from "vitest";
import { can, capabilitiesFor, highestRole } from "@/lib/access";

describe("role capabilities", () => {
  it("uses admin > leadership > member priority", () => {
    expect(
      highestRole(["member", "lead"], {
        member: ["member"],
        leadership: ["lead"],
        admin: [],
      }),
    ).toBe("leadership");
  });
  it("keeps raw data admin-only", () => {
    expect(can("leadership", "admin:read")).toBe(false);
    expect(can("admin", "admin:read")).toBe(true);
    expect(can("leadership", "protected-factions:manage")).toBe(false);
    expect(can("admin", "protected-factions:manage")).toBe(true);
  });
  it("allows members to read dashboards and manage personal rules", () => {
    expect(capabilitiesFor("member")).toContain("dashboard:read");
    expect(capabilitiesFor("member")).toContain("rules:write");
    expect(capabilitiesFor("member")).not.toContain("tenant-rules:write");
  });
  it("allows leadership to manage tenant rules and run BGS AI", () => {
    expect(can("leadership", "tenant-rules:write")).toBe(true);
    expect(can("leadership", "bgs-ai:run")).toBe(true);
  });
});

import { describe,expect,it } from "vitest";
import { can,capabilitiesFor,highestRole } from "@/lib/access";

describe("role capabilities",()=>{it("uses admin > leadership > member priority",()=>{expect(highestRole(["member","lead"],{member:["member"],leadership:["lead"],admin:[]})).toBe("leadership")});it("keeps raw data admin-only",()=>{expect(can("leadership","admin:read")).toBe(false);expect(can("admin","admin:read")).toBe(true)});it("allows members to read dashboards",()=>{expect(capabilitiesFor("member")).toContain("dashboard:read")})});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_TENANT_ID,
  resolveLoginTenantId,
} from "@/lib/login-preference";

const tenantIds = [
  "east-india-company",
  "valk-development",
  "impactive-profit-protectors",
] as const;

describe("resolveLoginTenantId", () => {
  it("defaults to VALK Development when no preference exists", () => {
    expect(resolveLoginTenantId(tenantIds)).toBe(DEFAULT_LOGIN_TENANT_ID);
  });

  it("restores a valid saved tenant", () => {
    expect(resolveLoginTenantId(tenantIds, "east-india-company")).toBe(
      "east-india-company",
    );
  });

  it("ignores stale or manipulated cookie values", () => {
    expect(resolveLoginTenantId(tenantIds, "unknown-tenant")).toBe(
      DEFAULT_LOGIN_TENANT_ID,
    );
  });
});

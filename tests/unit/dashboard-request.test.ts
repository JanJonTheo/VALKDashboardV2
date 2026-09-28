import { describe, expect, it } from "vitest";
import {
  DashboardRequestError,
  retryDashboardQuery,
} from "@/lib/dashboard-request";

describe("dashboard query retries", () => {
  it.each([400, 401, 403, 404, 429, 502, 503, 504])(
    "does not repeat HTTP %s and add load to the API",
    (status) => {
      expect(
        retryDashboardQuery(0, new DashboardRequestError("failed", status)),
      ).toBe(false);
    },
  );

  it.each(["AbortError", "TimeoutError"])("does not repeat %s", (name) => {
    expect(retryDashboardQuery(0, new DOMException("stopped", name))).toBe(
      false,
    );
  });

  it("allows one retry for a transient connection failure", () => {
    expect(retryDashboardQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retryDashboardQuery(1, new TypeError("Failed to fetch"))).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";
import { features } from "@/lib/features";

describe("analytics feature definitions", () => {
  it("keeps evaluation details equivalent to leaderboard details", () => {
    const leaderboard = features.find(
      (feature) => feature.key === "leaderboard",
    );
    const evaluations = features.find(
      (feature) => feature.key === "evaluations",
    );

    expect(evaluations?.columns).toEqual(leaderboard?.columns);
  });
});

import { describe, expect, it } from "vitest";
import {
  evaluationHistoryRange,
  evaluationHistorySeries,
} from "@/lib/evaluation-history";

const now = new Date("2026-09-03T15:42:00Z");

describe("evaluation history periods", () => {
  it("uses all 24 UTC hours for day periods", () => {
    const range = evaluationHistoryRange({ period: "cd", now });

    expect(range.start).toBe("2026-09-03T00:00:00.000Z");
    expect(range.end).toBe("2026-09-04T00:00:00.000Z");
    expect(range.granularity).toBe("hour");
    expect(range.buckets).toHaveLength(24);
    expect(range.buckets[0]).toMatchObject({ label: "00:00" });
    expect(range.buckets[23]).toMatchObject({ label: "23:00" });
  });

  it("uses Monday through Sunday for week periods", () => {
    const range = evaluationHistoryRange({ period: "cw", now });

    expect(range.start).toBe("2026-08-31T00:00:00.000Z");
    expect(range.end).toBe("2026-09-07T00:00:00.000Z");
    expect(range.granularity).toBe("day");
    expect(range.buckets).toHaveLength(7);
    expect(range.buckets[0].label).toContain("Mon");
    expect(range.buckets[6].label).toContain("Sun");
  });

  it("uses the complete calendar month and calendar year", () => {
    const month = evaluationHistoryRange({ period: "cm", now });
    const year = evaluationHistoryRange({ period: "y", now });

    expect(month.start).toBe("2026-09-01T00:00:00.000Z");
    expect(month.end).toBe("2026-10-01T00:00:00.000Z");
    expect(month.buckets).toHaveLength(30);
    expect(year.start).toBe("2026-01-01T00:00:00.000Z");
    expect(year.end).toBe("2027-01-01T00:00:00.000Z");
    expect(year.buckets).toHaveLength(12);
  });

  it("limits full history to the current and preceding eleven months", () => {
    const range = evaluationHistoryRange({ period: "all", now });

    expect(range.start).toBe("2025-10-01T00:00:00.000Z");
    expect(range.end).toBe("2026-10-01T00:00:00.000Z");
    expect(range.buckets).toHaveLength(12);
  });

  it("anchors current and last tick to the galaxy tick boundary", () => {
    const lastTick = "2026-09-03T10:18:02Z";
    const current = evaluationHistoryRange({ period: "ct", now, lastTick });
    const previous = evaluationHistoryRange({ period: "lt", now, lastTick });

    expect(current.start).toBe("2026-09-03T10:18:02.000Z");
    expect(current.end).toBe("2026-09-04T10:18:02.000Z");
    expect(current.buckets).toHaveLength(24);
    expect(previous.start).toBe("2026-09-02T10:18:02.000Z");
    expect(previous.end).toBe("2026-09-03T10:18:02.000Z");
    expect(previous.buckets).toHaveLength(24);
  });

  it("ranks commanders by the selected-period total and fills empty buckets", () => {
    const buckets = evaluationHistoryRange({ period: "cw", now }).buckets;
    const series = evaluationHistorySeries(
      [
        { bucket: "0", cmdr: "Valkyrie", value: 4 },
        { bucket: "2", cmdr: "Valkyrie", value: 6 },
        { bucket: "1", cmdr: "Rooke", value: 8 },
        { bucket: "1", cmdr: "Astra", value: 2 },
      ],
      buckets,
      2,
    );

    expect(series.map((item) => item.name)).toEqual(["Valkyrie", "Rooke"]);
    expect(series[0].total).toBe(10);
    expect(series[0].data.slice(0, 4)).toEqual([4, 0, 6, 0]);
  });
});

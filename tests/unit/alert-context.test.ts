import { describe, expect, it } from "vitest";
import { alertContext } from "@/lib/alert-context";
import type { BgsAlert } from "@/lib/bgs-rules";
import { normalizeWatchedSystems } from "@/lib/system-watchlist";
const alarm = (facts: Record<string, unknown>, event_key = "condition") =>
  ({
    facts,
    event_key,
    message: "Original alarm",
    severity: "warning",
    fired_ticktime: "2026-09-08T11:00:00Z",
  }) as BgsAlert;
describe("alarm presentation from stored facts", () => {
  it("distinguishes missing influence from a genuine zero value", () => {
    const system = normalizeWatchedSystems({
      data: [
        {
          requested_system: "Sol",
          available: true,
          system_info: { system_name: "Sol" },
          factions: [
            { name: "Unknown", influence: null },
            { name: "Zero", influence: 0 },
          ],
        },
      ],
    })[0];
    expect(
      system.factions.find((faction) => faction.name === "Unknown")
        ?.influenceKnown,
    ).toBe(false);
    expect(
      system.factions.find((faction) => faction.name === "Zero")
        ?.influenceKnown,
    ).not.toBe(false);
  });
  it("selects only the triggering pair, preserving the historical gap", () => {
    const result = alertContext(
      alarm(
        {
          tenant_faction: "EIC",
          threshold_pp: 2,
          entered_factions: [
            { faction: "Rival", gap_pp: 1.87 },
            { faction: "Other", gap_pp: 0.2 },
          ],
        },
        "gap:rival",
      ),
    );
    expect(result.factions).toEqual(["EIC", "Rival"]);
    expect(result.summary).toBe("Gap 1.87 pp");
    expect(result.threshold).toBe("Threshold 2.00 pp");
  });
  it("uses actual faction spelling ahead of a configured alias", () =>
    expect(
      alertContext(
        alarm({
          monitored_faction: "Old alias",
          tenant_faction: "Real name",
          loss_pp: 4,
          threshold_pp: 3,
        }),
      ).factions,
    ).toEqual(["Real name"]));
  it("handles controller gap and single-faction loss or threshold alarms", () => {
    expect(
      alertContext(
        alarm({ controlling_faction: "A", competitor: "B", gap_pp: 1.5 }),
      ).factions,
    ).toEqual(["A", "B"]);
    expect(
      alertContext(
        alarm({ controlling_faction: "A", loss_pp: 4, threshold_pp: 3 }),
      ).summary,
    ).toBe("Loss 4.00 pp");
    expect(
      alertContext(
        alarm({ tenant_faction: "A", tenant_influence_pp: 4, threshold_pp: 5 }),
      ).threshold,
    ).toBe("Below 5.00%");
  });
  it("handles conflict participants and strongest competitor changes", () => {
    expect(
      alertContext(
        alarm({
          new_conflicts: [{ faction1: "A", faction2: "B", type: "war" }],
        }),
      ).factions,
    ).toEqual(["A", "B"]);
    const changed = alertContext(
      alarm({
        controlling_faction: "A",
        strongest_change: { faction: "B", delta_pp: -3.5 },
        threshold_pp: 3,
      }),
    );
    expect(changed.factions).toEqual(["B"]);
    expect(changed.summary).toBe("Loss 3.50 pp");
  });
  it("does not invent factions or zero values for incomplete historical facts", () => {
    expect(
      alertContext(
        alarm(
          { tenant_faction: "A", tenant_influence_pp: 1, threshold_pp: 2 },
          "gap:missing",
        ),
      ).summary,
    ).toBe("Alarm details");
    expect(alertContext(alarm({})).factions).toEqual([]);
    expect(
      alertContext(
        alarm({
          tenant_faction: "A",
          entered_factions: [{ faction: "B" }, { faction: "C" }],
        }),
      ).factions,
    ).toEqual([]);
    expect(
      alertContext(
        alarm({
          tenant_faction: "A",
          tenant_influence_pp: null,
          threshold_pp: 5,
        }),
      ).summary,
    ).toBe("Alarm details");
  });
  it("retains resolution and event time", () => {
    const result = alertContext({
      ...alarm({}),
      resolved_at: "2026-09-09T00:00:00Z",
    });
    expect(result.resolved).toBe(true);
    expect(result.timestamp).toBe("2026-09-08T11:00:00Z");
  });
});

import { describe, expect, it } from "vitest";
import {
  stationCategory,
  stationIconKind,
  stationMatchesCategory,
} from "@/lib/system-stations";

describe("station categories", () => {
  it.each([
    ["Coriolis Starport", false, "starports"],
    ["Dodecagonal Agricultural Station", false, "starports"],
    ["Settlement", true, "settlements"],
    ["Drake-Class Carrier", false, "fleet-carriers"],
    ["Outpost", false, "outposts"],
    ["Planetary Outpost", false, "surface-ports"],
    ["Surface Port", false, "surface-ports"],
    ["Space Construction Depot", false, "installations"],
    ["Planetary Construction Depot", false, "installations"],
    ["Unknown Facility", false, "misc"],
  ])("classifies %s", (type, is_settlement, expected) => {
    expect(stationCategory({ type, is_settlement })).toBe(expected);
  });

  it("includes every facility in All", () => {
    expect(
      stationMatchesCategory(
        { type: "Completely New Facility", is_settlement: false },
        "all",
      ),
    ).toBe(true);
  });

  it.each([
    ["Coriolis Starport", "", "coriolis"],
    ["Dodec Starport", "", "dodec"],
    ["Orbis Starport", "", "orbis"],
    ["Ocellus Starport", "", "ocellus"],
    ["Asteroid base", "", "asteroid-base"],
    ["Outpost", "", "outpost"],
    ["Planetary Outpost", "Planet A", "surface-outpost"],
    ["Surface Port", "Planet A", "surface-port"],
    ["Settlement", "Planet A", "settlement"],
    ["Installation", "", "installation-space"],
    ["Installation", "Planet A", "installation-planetary"],
    ["Space Construction Depot", "", "installation-space"],
    ["Planetary Construction Depot", "Planet A", "installation-planetary"],
    ["Drake-Class Carrier", "", "fleet-carrier"],
  ])("uses the game-style icon for %s", (type, body, expected) => {
    expect(stationIconKind({ type, body })).toBe(expected);
  });
});

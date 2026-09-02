import { describe, expect, it } from "vitest";
import { bgsStatePresentation } from "@/lib/bgs-state";

describe("BGS state presentation", () => {
  it("keeps the Streamlit colours and icons for known states", () => {
    expect(bgsStatePresentation("CivilWar")).toMatchObject({
      label: "Civil War",
      colour: "#e74c3c",
      icon: "swords",
    });
    expect(bgsStatePresentation("Election")).toMatchObject({
      colour: "#e67e22",
      icon: "vote",
    });
    expect(bgsStatePresentation("PublicHoliday").label).toBe("Public Holiday");
  });

  it("humanizes unknown states and provides a neutral fallback", () => {
    expect(bgsStatePresentation("TechnologicalLeap").label).toBe(
      "Technological Leap",
    );
    expect(bgsStatePresentation("")).toMatchObject({
      label: "None",
      icon: "minus",
    });
  });
});

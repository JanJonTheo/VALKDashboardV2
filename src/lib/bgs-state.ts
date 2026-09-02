export type BgsStateIcon =
  | "swords"
  | "vote"
  | "trending-up"
  | "trending-down"
  | "flame"
  | "wheat-off"
  | "flask"
  | "coins"
  | "party"
  | "construction"
  | "sun"
  | "leaf"
  | "skull"
  | "arrow-down"
  | "minus";

export interface BgsStatePresentation {
  key: string;
  label: string;
  colour: string;
  icon: BgsStateIcon;
}

const statePresentations: Record<string, Omit<BgsStatePresentation, "key">> = {
  war: { label: "War", colour: "#e74c3c", icon: "swords" },
  civilwar: { label: "Civil War", colour: "#e74c3c", icon: "swords" },
  election: { label: "Election", colour: "#e67e22", icon: "vote" },
  elections: { label: "Election", colour: "#e67e22", icon: "vote" },
  expansion: {
    label: "Expansion",
    colour: "#3498db",
    icon: "trending-up",
  },
  boom: { label: "Boom", colour: "#2980b9", icon: "trending-up" },
  bust: { label: "Bust", colour: "#f1c40f", icon: "trending-down" },
  civilunrest: {
    label: "Civil Unrest",
    colour: "#f39c12",
    icon: "flame",
  },
  famine: { label: "Famine", colour: "#8e44ad", icon: "wheat-off" },
  outbreak: { label: "Outbreak", colour: "#16a085", icon: "flask" },
  investment: {
    label: "Investment",
    colour: "#27ae60",
    icon: "coins",
  },
  publicholiday: {
    label: "Public Holiday",
    colour: "#9b59b6",
    icon: "party",
  },
  infrastructurefailure: {
    label: "Infrastructure Failure",
    colour: "#7f8c8d",
    icon: "construction",
  },
  drought: { label: "Drought", colour: "#d35400", icon: "sun" },
  blight: { label: "Blight", colour: "#8e44ad", icon: "leaf" },
  pirateattack: {
    label: "Pirate Attack",
    colour: "#16a085",
    icon: "skull",
  },
  retreat: {
    label: "Retreat",
    colour: "#95a5a6",
    icon: "arrow-down",
  },
  none: { label: "None", colour: "#4b5563", icon: "minus" },
};

function humanizeState(value: string) {
  return value
    .replace(/^\$[^_]*_/, "")
    .replace(/;$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function bgsStatePresentation(value?: string): BgsStatePresentation {
  const raw = String(value ?? "").trim();
  const key = raw.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("en") || "none";
  const known = statePresentations[key];
  return known
    ? { key, ...known }
    : {
        key,
        label: humanizeState(raw) || "None",
        colour: "#64748b",
        icon: "minus",
      };
}

export type StationCategory =
  | "all"
  | "starports"
  | "outposts"
  | "surface-ports"
  | "settlements"
  | "installations"
  | "fleet-carriers"
  | "misc";

export const stationCategoryTabs: ReadonlyArray<{
  value: StationCategory;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "starports", label: "Starports" },
  { value: "outposts", label: "Outposts" },
  { value: "surface-ports", label: "Surface Ports/Outposts" },
  { value: "settlements", label: "Settlements" },
  { value: "installations", label: "Installations" },
  { value: "fleet-carriers", label: "Fleet Carriers" },
  { value: "misc", label: "Misc" },
];

export interface CategorisableStation {
  type: string;
  is_settlement?: boolean;
  body?: string;
}

export type StationIconKind =
  | "coriolis"
  | "dodec"
  | "orbis"
  | "ocellus"
  | "asteroid-base"
  | "outpost"
  | "surface-port"
  | "surface-outpost"
  | "settlement"
  | "installation-space"
  | "installation-planetary"
  | "fleet-carrier"
  | "misc";

export function stationCategory(
  station: CategorisableStation,
): Exclude<StationCategory, "all"> {
  const type = station.type.trim().toLocaleLowerCase("en");
  if (type.includes("carrier")) return "fleet-carriers";
  if (station.is_settlement || type.includes("settlement"))
    return "settlements";
  if (/planetary (port|outpost)|surface (port|outpost)|workshop/.test(type))
    return "surface-ports";
  if (/coriolis|orbis|ocellus|dodec|starport/.test(type)) return "starports";
  if (type.includes("outpost")) return "outposts";
  if (/installation|construction depot|megaship|mega ship/.test(type))
    return "installations";
  return "misc";
}

export function stationIconKind(
  station: CategorisableStation,
): StationIconKind {
  const type = station.type.trim().toLocaleLowerCase("en");
  if (type.includes("coriolis")) return "coriolis";
  if (type.includes("dodec")) return "dodec";
  if (type.includes("orbis")) return "orbis";
  if (type.includes("ocellus")) return "ocellus";
  if (type.includes("asteroid base")) return "asteroid-base";
  const category = stationCategory(station);
  if (category === "outposts") return "outpost";
  if (category === "surface-ports")
    return type.includes("outpost") ? "surface-outpost" : "surface-port";
  if (category === "settlements") return "settlement";
  if (category === "installations")
    return type.includes("planetary") || Boolean(station.body)
      ? "installation-planetary"
      : "installation-space";
  if (category === "fleet-carriers") return "fleet-carrier";
  return "misc";
}

export function stationMatchesCategory(
  station: CategorisableStation,
  category: StationCategory,
) {
  return category === "all" || stationCategory(station) === category;
}

import { z } from "zod";

export const systemWatchlistEntrySchema = z.object({
  system: z.string().trim().min(2).max(255),
  sector: z.string().trim().max(80).default(""),
  projectName: z.string().trim().max(160).default(""),
  favorite: z.boolean().default(false),
});

export const systemWatchlistSchema = z
  .object({
    systems: z.array(systemWatchlistEntrySchema).max(100).default([]),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.systems.forEach((entry, index) => {
      const key = entry.system.toLocaleLowerCase("en");
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["systems", index, "system"],
          message: "Each system can only appear once",
        });
      }
      seen.add(key);
    });
  });

export type SystemWatchlistEntry = z.infer<typeof systemWatchlistEntrySchema>;
export type SystemWatchlist = z.infer<typeof systemWatchlistSchema>;

export const watchlistSortOptions = [
  { value: "system", label: "System name" },
  { value: "sector", label: "Sector" },
  { value: "projectName", label: "Project name" },
  { value: "controllingFaction", label: "Controlling faction" },
  { value: "population", label: "Population" },
  { value: "security", label: "Security level" },
  { value: "allegiance", label: "Allegiance" },
  { value: "government", label: "Government" },
  { value: "economy", label: "Economy" },
  { value: "updatedAt", label: "Info updated" },
] as const;

export type WatchlistSortField = (typeof watchlistSortOptions)[number]["value"];

export interface InfluenceHistoryPoint {
  timestamp: string;
  influence: number;
}

export interface WatchedFaction {
  name: string;
  government: string;
  allegiance: string;
  activeStates: string[];
  pendingStates: string[];
  influence: number;
  history: InfluenceHistoryPoint[];
}

export interface WatchedConflict {
  faction1: string;
  faction2: string;
  status: string;
  type: string;
}

export interface WatchedSystem {
  requestedSystem: string;
  available: boolean;
  name: string;
  controllingFaction: string;
  allegiance: string;
  government: string;
  population: number;
  economy: string;
  security: string;
  powerplayPowers: string[];
  updatedAt: string;
  factions: WatchedFaction[];
  conflicts: WatchedConflict[];
}

export interface WatchlistFilters {
  system: string;
  controllingFaction: string;
  populationMin: string;
  populationMax: string;
  updatedFrom: string;
  updatedTo: string;
  allegiance: string;
  government: string;
  sector: string;
}

export const emptyWatchlistFilters: WatchlistFilters = {
  system: "",
  controllingFaction: "",
  populationMin: "",
  populationMax: "",
  updatedFrom: "",
  updatedTo: "",
  allegiance: "",
  government: "",
  sector: "",
};

function includesFolded(value: string, search: string) {
  return value
    .toLocaleLowerCase("en")
    .includes(search.trim().toLocaleLowerCase("en"));
}

function optionalFiniteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnlyTimestamp(value: string, endOfDay = false): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

export function matchesWatchlistFilters(
  entry: SystemWatchlistEntry,
  system: WatchedSystem | undefined,
  filters: WatchlistFilters,
): boolean {
  if (
    filters.system &&
    ![entry.system, entry.sector, entry.projectName].some((value) =>
      includesFolded(value, filters.system),
    )
  )
    return false;
  if (
    filters.controllingFaction &&
    !includesFolded(
      system?.controllingFaction ?? "",
      filters.controllingFaction,
    )
  )
    return false;
  if (filters.sector && entry.sector !== filters.sector) return false;
  if (filters.allegiance && system?.allegiance !== filters.allegiance)
    return false;
  if (filters.government && system?.government !== filters.government)
    return false;

  const populationMin = optionalFiniteNumber(filters.populationMin);
  const populationMax = optionalFiniteNumber(filters.populationMax);
  if (
    populationMin !== null &&
    (!system?.available || system.population < populationMin)
  )
    return false;
  if (
    populationMax !== null &&
    (!system?.available || system.population > populationMax)
  )
    return false;

  const updatedTimestamp = Date.parse(system?.updatedAt ?? "");
  const updatedFrom = dateOnlyTimestamp(filters.updatedFrom);
  const updatedTo = dateOnlyTimestamp(filters.updatedTo, true);
  if (
    updatedFrom !== null &&
    (!Number.isFinite(updatedTimestamp) || updatedTimestamp < updatedFrom)
  )
    return false;
  if (
    updatedTo !== null &&
    (!Number.isFinite(updatedTimestamp) || updatedTimestamp > updatedTo)
  )
    return false;
  return true;
}

export interface WatchlistDistributionItem {
  label: string;
  count: number;
}

export interface WatchlistFacilityStatistics {
  dodec: number;
  orbis: number;
  ocellus: number;
  coriolis: number;
  cachedSystems: number;
  requestedSystems: number;
}

export interface WatchlistStatistics {
  systemCount: number;
  availableCount: number;
  totalPopulation: number;
  largestPopulationSystem?: { name: string; population: number };
  security: WatchlistDistributionItem[];
  allegiance: WatchlistDistributionItem[];
  powerplay: WatchlistDistributionItem[];
  facilities: WatchlistDistributionItem[];
  facilityCachedSystems: number;
}

const factionColourPalette = [
  "#4cc9f0",
  "#ff6b7d",
  "#80df9e",
  "#ffc857",
  "#b998ff",
  "#ff9f43",
  "#2dd4bf",
  "#f062c0",
  "#6f95ff",
  "#b8e356",
  "#f45164",
  "#d4a5ff",
  "#e0a83e",
  "#72c7ff",
  "#ff7f50",
  "#9ae66e",
] as const;

function factionNameHash(name: string): number {
  let hash = 2166136261;
  for (const character of name.trim().toLocaleLowerCase("en")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Assigns stable, collision-free colours for all minor factions in one system.
 * Sorting first keeps the result independent from API row order.
 */
export function assignFactionColours(
  factions: Pick<WatchedFaction, "name">[],
): Map<string, string> {
  const names = [...new Set(factions.map((faction) => faction.name))].sort(
    (left, right) => left.localeCompare(right, "en", { sensitivity: "base" }),
  );
  const used = new Set<number>();
  const result = new Map<string, string>();
  names.forEach((name, position) => {
    const start = factionNameHash(name) % factionColourPalette.length;
    let index = start;
    for (let offset = 0; offset < factionColourPalette.length; offset += 1) {
      const candidate = (start + offset * 5) % factionColourPalette.length;
      if (!used.has(candidate)) {
        index = candidate;
        break;
      }
    }
    if (used.size >= factionColourPalette.length) {
      const hue = Math.round(
        (factionNameHash(name) + position * 137.508) % 360,
      );
      result.set(name, `hsl(${hue} 78% 68%)`);
      return;
    }
    used.add(index);
    result.set(name, factionColourPalette[index]);
  });
  return result;
}

export function hasTenantFaction(
  system: WatchedSystem,
  tenantFactionName: string,
): boolean {
  const acceptedNames = new Set(
    tenantFactionAliases(tenantFactionName).map((name) =>
      name.toLocaleLowerCase("en"),
    ),
  );
  const expected = tenantFactionName.trim().toLocaleLowerCase("en");
  // The VALK Development tenant historically used the organisation label
  // "Executive" while EDDN publishes the in-game minor-faction name without it.
  return (
    Boolean(expected) &&
    system.factions.some((faction) =>
      acceptedNames.has(faction.name.trim().toLocaleLowerCase("en")),
    )
  );
}

export function tenantFactionAliases(name: string): string[] {
  const primary = name.trim();
  if (!primary) return [];
  const aliases = [primary];
  if (primary.toLocaleLowerCase("en").endsWith(" executive"))
    aliases.push(primary.slice(0, -" executive".length).trim());
  return [...new Set(aliases.filter(Boolean))];
}

export function prioritizeFavoriteSystems(
  entries: SystemWatchlistEntry[],
): SystemWatchlistEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        Number(right.entry.favorite) - Number(left.entry.favorite) ||
        left.index - right.index,
    )
    .map(({ entry }) => entry);
}

function compareOptionalText(left: string, right: string, descending: boolean) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const compared = left.localeCompare(right, "en", {
    numeric: true,
    sensitivity: "base",
  });
  return descending ? -compared : compared;
}

function compareOptionalNumber(
  left: number | null,
  right: number | null,
  descending: boolean,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return descending ? right - left : left - right;
}

export function sortWatchlistEntries(
  entries: SystemWatchlistEntry[],
  systems: WatchedSystem[],
  field: WatchlistSortField,
  descending = false,
): SystemWatchlistEntry[] {
  const systemByName = new Map(
    systems.map((system) => [
      system.requestedSystem.toLocaleLowerCase("en"),
      system,
    ]),
  );
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const favoriteDifference =
        Number(right.entry.favorite) - Number(left.entry.favorite);
      if (favoriteDifference) return favoriteDifference;
      const leftSystem = systemByName.get(
        left.entry.system.toLocaleLowerCase("en"),
      );
      const rightSystem = systemByName.get(
        right.entry.system.toLocaleLowerCase("en"),
      );
      let compared = 0;
      if (field === "population") {
        compared = compareOptionalNumber(
          leftSystem?.available ? leftSystem.population : null,
          rightSystem?.available ? rightSystem.population : null,
          descending,
        );
      } else if (field === "updatedAt") {
        const leftTimestamp = Date.parse(leftSystem?.updatedAt ?? "");
        const rightTimestamp = Date.parse(rightSystem?.updatedAt ?? "");
        compared = compareOptionalNumber(
          Number.isFinite(leftTimestamp) ? leftTimestamp : null,
          Number.isFinite(rightTimestamp) ? rightTimestamp : null,
          descending,
        );
      } else {
        const leftValue =
          field === "system" || field === "sector" || field === "projectName"
            ? left.entry[field]
            : (leftSystem?.[field] ?? "");
        const rightValue =
          field === "system" || field === "sector" || field === "projectName"
            ? right.entry[field]
            : (rightSystem?.[field] ?? "");
        compared = compareOptionalText(leftValue, rightValue, descending);
      }
      return (
        compared ||
        compareOptionalText(left.entry.system, right.entry.system, false) ||
        left.index - right.index
      );
    })
    .map(({ entry }) => entry);
}

type Row = Record<string, unknown>;

function row(value: unknown): Row {
  return value && typeof value === "object" ? (value as Row) : {};
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Row => Boolean(entry) && typeof entry === "object",
      )
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return "";
}

function percentage(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number((Math.abs(parsed) <= 1 ? parsed * 100 : parsed).toFixed(2));
}

export function humanizeBgsValue(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  return raw
    .replace(/^\$/, "")
    .replace(/;$/, "")
    .replace(/^factionallegiance_/i, "")
    .replace(/^allegiance_/i, "")
    .replace(/^government_/i, "")
    .replace(/^economy_/i, "")
    .replace(/^system_security_/i, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(humanizeBgsValue).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return parseStringList(JSON.parse(value));
  } catch {
    return value.split(",").map(humanizeBgsValue).filter(Boolean);
  }
}

function distribution(values: string[]): WatchlistDistributionItem[] {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label, "en"),
    );
}

export function calculateWatchlistStatistics(
  systems: WatchedSystem[],
  systemCount = systems.length,
  facilityStatistics?: WatchlistFacilityStatistics,
): WatchlistStatistics {
  const available = systems.filter((system) => system.available);
  const largestPopulationSystem = available.reduce<
    WatchlistStatistics["largestPopulationSystem"]
  >(
    (largest, system) =>
      !largest || system.population > largest.population
        ? { name: system.name, population: system.population }
        : largest,
    undefined,
  );
  const allegianceOrder = ["Empire", "Federation", "Independent", "Alliance"];
  const allegianceCounts = new Map<string, number>(
    allegianceOrder.map((label) => [label, 0] as const),
  );
  available.forEach((system) => {
    const label = system.allegiance || "Unknown";
    allegianceCounts.set(label, (allegianceCounts.get(label) ?? 0) + 1);
  });
  const allegiance = [...allegianceCounts.entries()]
    .filter(([label, count]) => count > 0 || allegianceOrder.includes(label))
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      const leftIndex = allegianceOrder.indexOf(left.label);
      const rightIndex = allegianceOrder.indexOf(right.label);
      if (leftIndex >= 0 || rightIndex >= 0)
        return (
          (leftIndex < 0 ? allegianceOrder.length : leftIndex) -
          (rightIndex < 0 ? allegianceOrder.length : rightIndex)
        );
      return right.count - left.count || left.label.localeCompare(right.label);
    });
  const securityOrder = ["High", "Medium", "Low"];
  const securityCounts = new Map<string, number>(
    securityOrder.map((label) => [label, 0] as const),
  );
  available.forEach((system) => {
    const label = system.security;
    if (securityCounts.has(label))
      securityCounts.set(label, (securityCounts.get(label) ?? 0) + 1);
  });
  return {
    systemCount,
    availableCount: available.length,
    totalPopulation: available.reduce(
      (total, system) => total + system.population,
      0,
    ),
    largestPopulationSystem,
    security: securityOrder.map((label) => ({
      label,
      count: securityCounts.get(label) ?? 0,
    })),
    allegiance,
    powerplay: distribution(
      available.flatMap((system) =>
        system.powerplayPowers.length
          ? [...new Set(system.powerplayPowers)]
          : ["No power assigned"],
      ),
    ),
    facilities: [
      { label: "Dodecs", count: facilityStatistics?.dodec ?? 0 },
      { label: "Orbis", count: facilityStatistics?.orbis ?? 0 },
      { label: "Ocellus", count: facilityStatistics?.ocellus ?? 0 },
      { label: "Coriolis", count: facilityStatistics?.coriolis ?? 0 },
    ],
    facilityCachedSystems: facilityStatistics?.cachedSystems ?? 0,
  };
}

export function parseBgsStates(value: unknown): string[] {
  if (!value || value === "null") return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return humanizeBgsValue(entry);
        const item = row(entry);
        return humanizeBgsValue(item.State ?? item.state);
      })
      .filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      return parseBgsStates(JSON.parse(value));
    } catch {
      return value.split(",").map(humanizeBgsValue).filter(Boolean);
    }
  }
  return [];
}

export function normalizeWatchedSystems(value: unknown): WatchedSystem[] {
  const envelope = row(value);
  const entries = rows(envelope.data);
  const factionMetadata = new Map<
    string,
    { allegiance: string; government: string }
  >();

  for (const entry of entries) {
    for (const faction of rows(
      entry.factions ?? entry.minor_factions ?? entry.minor_faction_presences,
    )) {
      const name = firstText(faction.name, faction.Name);
      if (!name) continue;
      const known = factionMetadata.get(name.toLocaleLowerCase("en"));
      const allegiance = humanizeBgsValue(
        firstText(faction.allegiance, faction.Allegiance),
      );
      const government = humanizeBgsValue(
        firstText(
          faction.government,
          faction.Government_Localised,
          faction.Government,
        ),
      );
      factionMetadata.set(name.toLocaleLowerCase("en"), {
        allegiance: known?.allegiance || allegiance,
        government: known?.government || government,
      });
    }
  }

  return entries.map((entry) => {
    const info = row(entry.system_info);
    const systemAllegiance = humanizeBgsValue(
      firstText(info.allegiance, info.Allegiance),
    );
    const controllingFaction = firstText(
      info.controlling_faction,
      info.ControllingFaction,
    );
    const historyByFaction = new Map<string, InfluenceHistoryPoint[]>();
    for (const snapshot of rows(entry.history)) {
      const timestamp = text(snapshot.ticktime ?? snapshot.timestamp);
      if (!timestamp) continue;
      for (const faction of rows(snapshot.factions)) {
        const name = text(faction.name ?? faction.Name);
        if (!name) continue;
        const points = historyByFaction.get(name) ?? [];
        points.push({
          timestamp,
          influence: percentage(faction.influence ?? faction.Influence),
        });
        historyByFaction.set(name, points);
      }
    }

    const factions = rows(
      entry.factions ?? entry.minor_factions ?? entry.minor_faction_presences,
    )
      .map((faction): WatchedFaction => {
        const name = firstText(faction.name, faction.Name);
        const known = factionMetadata.get(name.toLocaleLowerCase("en"));
        const isControllingFaction =
          Boolean(controllingFaction) &&
          name.localeCompare(controllingFaction, "en", {
            sensitivity: "base",
          }) === 0;
        const currentInfluence = percentage(
          faction.influence ?? faction.Influence,
        );
        const history = historyByFaction.get(name) ?? [];
        if (
          currentInfluence > 0 &&
          !history.some(
            (point) =>
              point.timestamp === text(faction.updated_at ?? info.updated_at),
          )
        ) {
          history.push({
            timestamp: text(faction.updated_at ?? info.updated_at),
            influence: currentInfluence,
          });
        }
        history.sort((left, right) =>
          left.timestamp.localeCompare(right.timestamp),
        );
        const activeStates = [
          ...parseBgsStates(faction.active_states ?? faction.activeStates),
          ...parseBgsStates(faction.state),
        ];
        return {
          name,
          government:
            humanizeBgsValue(
              firstText(
                faction.government,
                faction.Government_Localised,
                faction.Government,
              ),
            ) ||
            known?.government ||
            "",
          allegiance:
            humanizeBgsValue(
              firstText(faction.allegiance, faction.Allegiance),
            ) ||
            known?.allegiance ||
            (isControllingFaction ? systemAllegiance : ""),
          activeStates: [...new Set(activeStates)],
          pendingStates: parseBgsStates(
            faction.pending_states ?? faction.pendingStates,
          ),
          influence: currentInfluence,
          history,
        };
      })
      .filter((faction) => faction.name)
      .sort((left, right) => right.influence - left.influence);

    const conflicts = rows(entry.conflicts).map(
      (conflict): WatchedConflict => ({
        faction1: text(conflict.faction1),
        faction2: text(conflict.faction2),
        status: humanizeBgsValue(conflict.status),
        type: humanizeBgsValue(conflict.war_type ?? conflict.type),
      }),
    );
    const powerplayPowers = [
      ...parseStringList(info.controlling_power),
      ...rows(entry.powerplays).flatMap((powerplay) =>
        parseStringList(powerplay.power ?? powerplay.powers),
      ),
    ];

    const requestedSystem = text(
      entry.requested_system ?? info.system_name ?? info.name,
    );
    return {
      requestedSystem,
      available: entry.available !== false && Boolean(info.system_name),
      name: text(info.system_name ?? info.name ?? requestedSystem),
      controllingFaction,
      allegiance: systemAllegiance,
      government: humanizeBgsValue(info.government),
      population: Number(info.population) || 0,
      economy: humanizeBgsValue(
        info.economy ?? info.system_economy ?? info.primary_economy,
      ),
      security: humanizeBgsValue(info.security),
      powerplayPowers: [...new Set(powerplayPowers)],
      updatedAt: text(info.updated_at),
      factions,
      conflicts,
    };
  });
}

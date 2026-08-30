import { z } from "zod";

export const globalWatchlistPageSize = 25;

export const globalWatchlistSortOptions = [
  { value: "system", label: "System name" },
  { value: "population", label: "Population" },
  { value: "updatedAt", label: "Info updated" },
  { value: "controllingFaction", label: "Controlling faction" },
  { value: "allegiance", label: "Allegiance" },
  { value: "government", label: "Government" },
] as const;

export type GlobalWatchlistSortField =
  (typeof globalWatchlistSortOptions)[number]["value"];

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().finite().nonnegative().optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().date().optional(),
);

export const globalWatchlistQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().max(100_000).default(1),
    sort: z
      .enum(globalWatchlistSortOptions.map((option) => option.value))
      .default("system"),
    direction: z.enum(["asc", "desc"]).default("asc"),
    system: z.string().trim().max(255).default(""),
    controlling_faction: z.string().trim().max(255).default(""),
    population_min: optionalNumber,
    population_max: optionalNumber,
    updated_from: optionalDate,
    updated_to: optionalDate,
    allegiance: z.string().trim().max(120).default(""),
    government: z.string().trim().max(160).default(""),
  })
  .superRefine((value, context) => {
    if (
      value.population_min !== undefined &&
      value.population_max !== undefined &&
      value.population_min > value.population_max
    )
      context.addIssue({
        code: "custom",
        path: ["population_max"],
        message:
          "Maximum population must not be smaller than minimum population",
      });
    if (
      value.updated_from &&
      value.updated_to &&
      value.updated_from > value.updated_to
    )
      context.addIssue({
        code: "custom",
        path: ["updated_to"],
        message: "Updated-to date must not be before updated-from date",
      });
  });

export type GlobalWatchlistQuery = z.infer<typeof globalWatchlistQuerySchema>;

export interface GlobalWatchlistFilterOption {
  value: string;
  label: string;
}

export interface GlobalSystemIndexRow {
  system_name: string;
  population: number | null;
  updated_at: string;
  controlling_faction: string;
  allegiance: string;
  government: string;
}

function folded(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function compareText(left: string, right: string, descending: boolean) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const compared = left.localeCompare(right, "en", {
    numeric: true,
    sensitivity: "base",
  });
  return descending ? -compared : compared;
}

function compareNumber(
  left: number | null,
  right: number | null,
  descending: boolean,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return descending ? right - left : left - right;
}

export function filterAndSortGlobalSystems(
  rows: GlobalSystemIndexRow[],
  query: GlobalWatchlistQuery,
): GlobalSystemIndexRow[] {
  const systemNeedle = folded(query.system);
  const controllingNeedle = folded(query.controlling_faction);
  const allegiance = folded(query.allegiance);
  const government = folded(query.government);
  const filtered = rows.filter((row) => {
    if (systemNeedle && !folded(row.system_name).includes(systemNeedle))
      return false;
    if (
      controllingNeedle &&
      !folded(row.controlling_faction).includes(controllingNeedle)
    )
      return false;
    if (allegiance && folded(row.allegiance) !== allegiance) return false;
    if (government && folded(row.government) !== government) return false;
    if (
      query.population_min !== undefined &&
      (row.population === null || row.population < query.population_min)
    )
      return false;
    if (
      query.population_max !== undefined &&
      (row.population === null || row.population > query.population_max)
    )
      return false;
    const updatedDate = row.updated_at.slice(0, 10);
    if (
      query.updated_from &&
      (!updatedDate || updatedDate < query.updated_from)
    )
      return false;
    if (query.updated_to && (!updatedDate || updatedDate > query.updated_to))
      return false;
    return true;
  });
  const descending = query.direction === "desc";
  return filtered.sort((left, right) => {
    let compared = 0;
    if (query.sort === "population")
      compared = compareNumber(left.population, right.population, descending);
    else {
      const fields: Record<
        Exclude<GlobalWatchlistSortField, "population">,
        keyof GlobalSystemIndexRow
      > = {
        system: "system_name",
        updatedAt: "updated_at",
        controllingFaction: "controlling_faction",
        allegiance: "allegiance",
        government: "government",
      };
      compared = compareText(
        String(left[fields[query.sort]] ?? ""),
        String(right[fields[query.sort]] ?? ""),
        descending,
      );
    }
    return compared || compareText(left.system_name, right.system_name, false);
  });
}

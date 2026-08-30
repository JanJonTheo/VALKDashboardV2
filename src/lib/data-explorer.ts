export const DATA_EXPLORER_TABLES = [
  "event",
  "market_buy_event",
  "market_sell_event",
  "mission_completed_event",
  "mission_completed_influence",
  "mission_failed_event",
  "faction_kill_bond_event",
  "redeem_voucher_event",
  "sell_exploration_data_event",
  "multi_sell_exploration_data_event",
  "activity",
  "system",
  "faction",
  "cmdr",
] as const;

export type DataExplorerTable = (typeof DATA_EXPLORER_TABLES)[number];

export const COLONISATION_EVENTS = [
  "ColonisationSystemClaim",
  "ColonisationBeaconDeployed",
  "ColonisationConstructionDepot",
  "ColonisationContribution",
] as const;

export const EVENT_TABLE_COLUMNS = [
  "id",
  "timestamp",
  "event",
  "cmdr",
  "starsystem",
  "systemaddress",
  "station",
  "tickid",
  "processed",
  "raw_json",
] as const;

export type DataExplorerRow = Record<string, unknown>;

export interface DataExplorerFilter {
  field: string;
  operator: "contains" | "eq" | "gte" | "lte";
  value: string;
}

export interface EventFilterState {
  cmdr: string;
  event: string;
  tickid: string;
  colonisationOnly: boolean;
  dateFilter: boolean;
  fromDate: string;
  toDate: string;
}

export interface DataExplorerFilterOptions {
  cmdrs: string[];
  events: string[];
  tickids: string[];
}

export function isDataExplorerTable(value: string): value is DataExplorerTable {
  return (DATA_EXPLORER_TABLES as readonly string[]).includes(value);
}

export function dataExplorerTableLabel(table: DataExplorerTable): string {
  return table
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function buildEventFilters(
  state: EventFilterState,
): DataExplorerFilter[] {
  const filters: DataExplorerFilter[] = [];
  if (state.cmdr.trim())
    filters.push({ field: "cmdr", operator: "eq", value: state.cmdr.trim() });
  if (state.event.trim()) {
    filters.push({
      field: "event",
      operator: "eq",
      value: state.event.trim(),
    });
  } else if (state.colonisationOnly) {
    // Every known colonisation journal event starts with this prefix. Using a
    // contains filter keeps this compatible with the existing Flask table API.
    filters.push({
      field: "event",
      operator: "contains",
      value: "Colonisation",
    });
  }
  if (state.tickid.trim())
    filters.push({
      field: "tickid",
      operator: "eq",
      value: state.tickid.trim(),
    });
  if (state.dateFilter && state.fromDate)
    filters.push({
      field: "timestamp",
      operator: "gte",
      value: `${state.fromDate}T00:00:00Z`,
    });
  if (state.dateFilter && state.toDate)
    filters.push({
      field: "timestamp",
      operator: "lte",
      value: `${state.toDate}T23:59:59.999Z`,
    });
  return filters;
}

function searchableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function rowMatchesExplorerSearch(
  row: DataExplorerRow,
  search: string,
): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return Object.values(row).some((value) =>
    searchableValue(value).toLocaleLowerCase().includes(needle),
  );
}

export function orderExplorerColumns(
  columns: Iterable<string>,
  table: string,
): string[] {
  const unique = [...new Set(columns)].filter(Boolean);
  if (table !== "event") return unique;
  const preferred = EVENT_TABLE_COLUMNS.filter((column) =>
    unique.includes(column),
  );
  return [
    ...preferred,
    ...unique.filter(
      (column) => !(EVENT_TABLE_COLUMNS as readonly string[]).includes(column),
    ),
  ];
}

function uniqueValues(rows: DataExplorerRow[], column: string): string[] {
  const values = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values)].sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function collectExplorerFilterOptions(
  rows: DataExplorerRow[],
): DataExplorerFilterOptions {
  return {
    cmdrs: uniqueValues(rows, "cmdr"),
    events: [
      ...new Set([...uniqueValues(rows, "event"), ...COLONISATION_EVENTS]),
    ].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" }),
    ),
    tickids: uniqueValues(rows, "tickid").reverse(),
  };
}

function decodePythonSingleQuotedString(
  source: string,
  start: number,
): { value: string; end: number } | null {
  let value = "";
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "'") return { value, end: index };
    if (character !== "\\") {
      value += character;
      continue;
    }
    index += 1;
    if (index >= source.length) return null;
    const escaped = source[index];
    const replacements: Record<string, string> = {
      "'": "'",
      '"': '"',
      "\\": "\\",
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
    };
    value += replacements[escaped] ?? escaped;
  }
  return null;
}

function pythonLiteralToJson(source: string): string | null {
  let result = "";
  let inDoubleQuote = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inDoubleQuote) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inDoubleQuote = false;
      continue;
    }
    if (character === '"') {
      inDoubleQuote = true;
      result += character;
      continue;
    }
    if (character === "'") {
      const parsed = decodePythonSingleQuotedString(source, index);
      if (!parsed) return null;
      result += JSON.stringify(parsed.value);
      index = parsed.end;
      continue;
    }
    const token = source.slice(index).match(/^(True|False|None)\b/);
    if (token) {
      result += { True: "true", False: "false", None: "null" }[
        token[1] as "True" | "False" | "None"
      ];
      index += token[1].length - 1;
      continue;
    }
    result += character;
  }
  return result;
}

export function parseExplorerJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const source = value.trim();
  if (!source) return "";
  try {
    return JSON.parse(source) as unknown;
  } catch {
    const normalized = pythonLiteralToJson(source);
    if (!normalized) return value;
    try {
      return JSON.parse(normalized) as unknown;
    } catch {
      return value;
    }
  }
}

export function explorerJsonText(value: unknown): string {
  const parsed = parseExplorerJson(value);
  if (typeof parsed === "string") return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed ?? "");
  }
}

function serialiseCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function delimitedCell(value: unknown, delimiter: string): string {
  let text = serialiseCell(value);
  if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(text))
    text = `'${text}`;
  if (
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  )
    return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function rowsToDelimited(
  rows: DataExplorerRow[],
  delimiter: string,
  columns?: string[],
): string {
  const selectedColumns = columns ?? [
    ...new Set(rows.flatMap((row) => Object.keys(row))),
  ];
  if (!selectedColumns.length) return "";
  const lines = [
    selectedColumns
      .map((column) => delimitedCell(column, delimiter))
      .join(delimiter),
    ...rows.map((row) =>
      selectedColumns
        .map((column) => delimitedCell(row[column], delimiter))
        .join(delimiter),
    ),
  ];
  return lines.join("\r\n");
}

export function rowsToCsv(rows: DataExplorerRow[], columns?: string[]): string {
  return rowsToDelimited(rows, ",", columns);
}

export function rowsToClipboard(
  rows: DataExplorerRow[],
  columns?: string[],
): string {
  return rowsToDelimited(rows, "\t", columns);
}

function stringHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1)
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

export function explorerRowId(table: string, row: DataExplorerRow): string {
  for (const key of ["id", "event_id", "uuid", "name"]) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim())
      return `${table}:${key}:${String(value)}`;
  }
  return `${table}:row:${stringHash(JSON.stringify(row))}`;
}

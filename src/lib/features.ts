import type { Capability } from "./access";
import { DATA_EXPLORER_TABLES, dataExplorerTableLabel } from "./data-explorer";

export type FeatureKey =
  | "leaderboard"
  | "evaluations"
  | "monthly-performance"
  | "cmdrs"
  | "recruits"
  | "vouchers"
  | "cz-summary"
  | "objectives"
  | "colonisation"
  | "systems"
  | "factions-24h"
  | "data-explorer"
  | "health";

export interface FeatureColumn {
  key: string;
  label: string;
  numeric?: boolean;
  priority?: boolean;
}

export interface FeatureMetric {
  label: string;
  key: string;
  suffix?: string;
}

export interface FeatureFilterOption {
  label: string;
  value: string;
}

export interface FeatureFilter {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "multiselect" | "date" | "month";
  placement?: "page" | "drawer";
  /** Query parameter understood by Flask. Omit for client-only filters. */
  param?: string;
  /** Normalized row field used for client-side filtering. */
  field?: string;
  defaultValue?: string;
  placeholder?: string;
  options?: FeatureFilterOption[];
}

export interface FeatureSpec {
  key: FeatureKey;
  area: "analytics" | "operations" | "intelligence" | "admin";
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  endpoint: string;
  refreshMs: number | false;
  filters: FeatureFilter[];
  columns: FeatureColumn[];
  metrics: FeatureMetric[];
  chart?: {
    title: string;
    category: string;
    series: { key: string; label: string }[];
  };
  capability?: Capability;
  actions?: ("create-objective" | "discord-report" | "ai-assessment")[];
}

const min = 60_000;

export const periodOptions: FeatureFilterOption[] = [
  { value: "ct", label: "Current tick" },
  { value: "lt", label: "Last tick" },
  { value: "cd", label: "Today" },
  { value: "ld", label: "Yesterday" },
  { value: "cw", label: "Current week" },
  { value: "lw", label: "Last week" },
  { value: "cm", label: "Current month" },
  { value: "lm", label: "Last month" },
  { value: "2m", label: "Last two completed months" },
  { value: "y", label: "Current year" },
  { value: "all", label: "All time" },
  { value: "date-range", label: "Custom date range" },
  { value: "month-range", label: "Custom month range" },
];

const periodFilter = (defaultValue = "all"): FeatureFilter => ({
  key: "period",
  label: "Period",
  type: "select",
  param: "period",
  defaultValue,
  options: periodOptions,
});

export const features: FeatureSpec[] = [
  {
    key: "leaderboard",
    area: "analytics",
    slug: "leaderboard",
    title: "Leaderboard",
    eyebrow: "ANALYTICS / PERFORMANCE",
    description:
      "Commander trade and activity totals for the selected API period.",
    endpoint: "summary/leaderboard",
    refreshMs: 5 * min,
    filters: [
      { ...periodFilter("cm"), placement: "page" },
      {
        key: "from_date",
        label: "From date",
        type: "date",
        param: "from_date",
        placement: "page",
      },
      {
        key: "to_date",
        label: "To date",
        type: "date",
        param: "to_date",
        placement: "page",
      },
      {
        key: "from_month",
        label: "From month",
        type: "month",
        placement: "page",
      },
      { key: "to_month", label: "To month", type: "month", placement: "page" },
      {
        key: "system_name",
        label: "System",
        param: "system_name",
        placeholder: "Exact system name",
      },
    ],
    columns: [
      { key: "position", label: "#", numeric: true },
      { key: "cmdr", label: "Commander", priority: true },
      { key: "squadronRank", label: "Squadron rank" },
      { key: "missions", label: "Missions completed", numeric: true },
      { key: "missionFailures", label: "Missions failed", numeric: true },
      { key: "influence", label: "Influence", numeric: true },
      { key: "buy", label: "Buy", numeric: true },
      { key: "sell", label: "Sell", numeric: true },
      { key: "profit", label: "Profit", numeric: true },
      { key: "volume", label: "Volume", numeric: true },
      { key: "quantity", label: "Quantity", numeric: true },
      { key: "bountyVouchers", label: "Bounty vouchers", numeric: true },
      { key: "combatBonds", label: "Combat bonds", numeric: true },
      { key: "explorationSales", label: "Exploration sales", numeric: true },
      { key: "bountyFines", label: "Bounty fines", numeric: true },
    ],
    metrics: [
      { label: "Commanders", key: "commanders" },
      { label: "Selected total", key: "selectedTotal" },
      { label: "Selected average", key: "selectedAverage" },
      { label: "Selected top", key: "selectedTop" },
    ],
    chart: {
      title: "Missions Completed by commander",
      category: "cmdr",
      series: [{ key: "missions", label: "Missions Completed" }],
    },
  },
  {
    key: "evaluations",
    area: "analytics",
    slug: "evaluations",
    title: "Evaluations",
    eyebrow: "ANALYTICS / EVALUATIONS",
    description:
      "Consolidated evaluation inputs from the existing leaderboard contract.",
    endpoint: "summary/leaderboard",
    refreshMs: 5 * min,
    filters: [
      { ...periodFilter(), placement: "page" },
      {
        key: "from_date",
        label: "From date",
        type: "date",
        param: "from_date",
        placement: "page",
      },
      {
        key: "to_date",
        label: "To date",
        type: "date",
        param: "to_date",
        placement: "page",
      },
      {
        key: "from_month",
        label: "From month",
        type: "month",
        placement: "page",
      },
      {
        key: "to_month",
        label: "To month",
        type: "month",
        placement: "page",
      },
      {
        key: "commander",
        label: "Commander",
        field: "cmdr",
        placeholder: "Filter loaded commanders",
      },
    ],
    columns: [
      { key: "position", label: "#", numeric: true },
      { key: "cmdr", label: "Commander", priority: true },
      { key: "squadronRank", label: "Squadron rank" },
      { key: "missions", label: "Missions", numeric: true },
      { key: "quantity", label: "Trade quantity", numeric: true },
      { key: "bountyVouchers", label: "Bounty vouchers", numeric: true },
      { key: "combatBonds", label: "Combat bonds", numeric: true },
    ],
    metrics: [
      { label: "Evaluated", key: "commanders" },
      { label: "Missions", key: "missions" },
      { label: "Trade quantity", key: "quantity" },
      { label: "Bounty vouchers", key: "bountyVouchers" },
    ],
    chart: {
      title: "Completed missions",
      category: "cmdr",
      series: [{ key: "missions", label: "Missions" }],
    },
    actions: ["discord-report"],
  },
  {
    key: "monthly-performance",
    area: "analytics",
    slug: "monthly-performance",
    title: "Monthly performance",
    eyebrow: "ANALYTICS / MONTHLY",
    description:
      "Peer-relative contribution scores for the last three completed months.",
    endpoint: "summary/leaderboard",
    refreshMs: 30 * min,
    filters: [
      {
        key: "commander",
        label: "Commander",
        field: "cmdr",
        placeholder: "Filter loaded commanders",
      },
    ],
    columns: [
      { key: "cmdr", label: "Commander", priority: true },
      { key: "month1", label: "Month 1", numeric: true },
      { key: "month2", label: "Month 2", numeric: true },
      { key: "month3", label: "Month 3", numeric: true },
      { key: "score", label: "Latest contribution", numeric: true },
      { key: "trend", label: "Change" },
    ],
    metrics: [
      { label: "Contributors", key: "commanders" },
      { label: "Latest top score", key: "topScore" },
      { label: "Trade volume", key: "volume" },
      { label: "Missions", key: "missions" },
    ],
    chart: {
      title: "Three-month contribution comparison",
      category: "cmdr",
      series: [
        { key: "month1", label: "Month 1" },
        { key: "month2", label: "Month 2" },
        { key: "month3", label: "Month 3" },
      ],
    },
    actions: ["ai-assessment"],
  },
  {
    key: "cmdrs",
    area: "analytics",
    slug: "commanders",
    title: "Commander overview",
    eyebrow: "ANALYTICS / COMMANDERS",
    description:
      "Registered commander and squadron rank data from the tenant database.",
    endpoint: "table/cmdr",
    refreshMs: 5 * min,
    filters: [
      {
        key: "squadron",
        label: "Squadron",
        field: "squadron",
        placeholder: "Filter loaded squadrons",
      },
    ],
    columns: [
      { key: "cmdr", label: "Commander", priority: true },
      { key: "squadron", label: "Squadron" },
      { key: "squadronRank", label: "Squadron rank" },
      { key: "combatRank", label: "Combat rank" },
      { key: "tradeRank", label: "Trade rank" },
      { key: "exploreRank", label: "Exploration rank" },
      { key: "power", label: "Power" },
    ],
    metrics: [
      { label: "Registered commanders", key: "commanders" },
      { label: "Squadron members", key: "squadronMembers" },
      { label: "Squadrons", key: "squadrons" },
      { label: "Power aligned", key: "powerAligned" },
    ],
  },
  {
    key: "recruits",
    area: "analytics",
    slug: "recruits",
    title: "Recruits overview",
    eyebrow: "ANALYTICS / RECRUITS",
    description: "Recruit activity and onboarding data from the existing API.",
    endpoint: "summary/recruits",
    refreshMs: 5 * min,
    filters: [
      {
        key: "commander",
        label: "Commander",
        field: "cmdr",
        placeholder: "Filter loaded recruits",
      },
    ],
    columns: [
      { key: "cmdr", label: "Recruit", priority: true },
      { key: "lastActive", label: "Last active" },
      { key: "daysSinceJoin", label: "Days since join", numeric: true },
      { key: "tonnage", label: "Tonnage", numeric: true },
      { key: "missions", label: "Missions", numeric: true },
      { key: "bountyClaims", label: "Bounty claims", numeric: true },
      { key: "hasData", label: "Has data" },
    ],
    metrics: [
      { label: "Recruits", key: "commanders" },
      { label: "With data", key: "withData" },
      { label: "Missions", key: "missions" },
      { label: "Tonnage", key: "quantity" },
    ],
  },
  {
    key: "vouchers",
    area: "analytics",
    slug: "bounty-vouchers",
    title: "Bounty voucher redemptions",
    eyebrow: "ANALYTICS / VOUCHERS",
    description: "Voucher redemptions by commander, system and faction.",
    endpoint: "bounty-vouchers",
    refreshMs: 5 * min,
    filters: [
      periodFilter(),
      {
        key: "cmdr",
        label: "Commander",
        param: "cmdr",
        placeholder: "Exact commander name",
      },
      {
        key: "system",
        label: "System",
        param: "system",
        placeholder: "Exact system name",
      },
      {
        key: "faction",
        label: "Faction",
        param: "faction",
        placeholder: "Exact faction name",
      },
    ],
    columns: [
      { key: "cmdr", label: "Commander", priority: true },
      { key: "system", label: "System" },
      { key: "faction", label: "Faction" },
      { key: "redeemed", label: "Redeemed", numeric: true },
      { key: "tickId", label: "Tick ID" },
      { key: "timestamp", label: "Timestamp" },
    ],
    metrics: [
      { label: "Redeemed", key: "redeemed" },
      { label: "Commanders", key: "commanders" },
      { label: "Transactions", key: "transactions" },
      { label: "Systems", key: "systems" },
    ],
    chart: {
      title: "Redemptions by event",
      category: "cmdr",
      series: [{ key: "redeemed", label: "Redeemed" }],
    },
  },
  {
    key: "cz-summary",
    area: "analytics",
    slug: "conflict-zones",
    title: "Conflict zones",
    eyebrow: "ANALYTICS / COMBAT",
    description:
      "Space and ground CZ event counts by period, system and commander.",
    endpoint: "syntheticcz-summary",
    refreshMs: 5 * min,
    filters: [
      periodFilter(),
      {
        key: "system_name",
        label: "System",
        param: "system_name",
        placeholder: "Exact system name",
      },
    ],
    columns: [
      { key: "cmdr", label: "Commander", priority: true },
      { key: "system", label: "System" },
      { key: "zone", label: "Zone" },
      { key: "difficulty", label: "Difficulty" },
      { key: "faction", label: "Faction" },
      { key: "events", label: "Events", numeric: true },
    ],
    metrics: [
      { label: "CZ events", key: "events" },
      { label: "Commanders", key: "commanders" },
      { label: "Systems", key: "systems" },
      { label: "Factions", key: "factions" },
    ],
    chart: {
      title: "CZ events by commander",
      category: "cmdr",
      series: [{ key: "events", label: "Events" }],
    },
  },
  {
    key: "objectives",
    area: "operations",
    slug: "objectives",
    title: "Objectives",
    eyebrow: "OPERATIONS / OBJECTIVES",
    description: "Coordinate active targets, overrides and settlements.",
    endpoint: "objectives",
    refreshMs: 5 * min,
    filters: [
      {
        key: "active",
        label: "Status",
        type: "select",
        param: "active",
        defaultValue: "false",
        options: [
          { value: "false", label: "All objectives" },
          { value: "true", label: "Active only" },
        ],
      },
      {
        key: "system",
        label: "System",
        param: "system",
        placeholder: "Exact system name",
      },
      {
        key: "faction",
        label: "Faction",
        param: "faction",
        placeholder: "Exact faction name",
      },
    ],
    columns: [
      { key: "title", label: "Objective", priority: true },
      { key: "system", label: "System" },
      { key: "faction", label: "Faction" },
      { key: "progress", label: "Progress", numeric: true },
      { key: "endDate", label: "End date" },
      { key: "status", label: "Status" },
    ],
    metrics: [
      { label: "Objectives", key: "objectives" },
      { label: "Targets", key: "targets" },
      { label: "Settlements", key: "settlements" },
      { label: "Average progress", key: "averageProgress", suffix: "%" },
    ],
    chart: {
      title: "Objective progress",
      category: "title",
      series: [{ key: "progress", label: "Progress" }],
    },
    actions: ["create-objective"],
  },
  {
    key: "colonisation",
    area: "operations",
    slug: "colonisation",
    title: "Colonisation",
    eyebrow: "OPERATIONS / COLONISATION",
    description: "Contributions, constructions and commodity totals.",
    endpoint: "colonisation/contributions",
    refreshMs: 5 * min,
    filters: [
      periodFilter(),
      {
        key: "cmdr",
        label: "Commander",
        type: "multiselect",
        options: [{ value: "", label: "Any commander" }],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "", label: "Any status" },
          { value: "open", label: "open" },
          { value: "finished", label: "finished" },
        ],
      },
      {
        key: "system",
        label: "System",
        type: "select",
        options: [{ value: "", label: "Any system" }],
      },
      {
        key: "from_date",
        label: "Date from",
        type: "date",
        param: "from",
      },
      {
        key: "to_date",
        label: "Date to",
        type: "date",
        param: "to",
      },
      {
        key: "commodity",
        label: "Commodity",
        type: "multiselect",
        options: [{ value: "", label: "Any commodity" }],
      },
      {
        key: "visual_limit",
        label: "Visual analysis",
        type: "select",
        defaultValue: "5",
        options: [
          { value: "5", label: "Top 5" },
          { value: "10", label: "Top 10" },
          { value: "25", label: "Top 25" },
        ],
      },
      {
        key: "commodity_diff",
        label: "Commodity Diff",
        type: "select",
        options: [
          { value: "", label: "Alle" },
          { value: "yes", label: "Ja (Diff > 0)" },
          { value: "no", label: "Nein (Diff = 0)" },
        ],
      },
    ],
    columns: [
      { key: "construction", label: "Construction", priority: true },
      { key: "cmdr", label: "Commander" },
      { key: "commodity", label: "Commodity" },
      { key: "delivered", label: "Delivered", numeric: true },
      { key: "required", label: "Required", numeric: true },
      { key: "status", label: "Status" },
    ],
    metrics: [
      { label: "Delivered", key: "delivered" },
      { label: "Required", key: "required" },
      { label: "Contributors", key: "commanders" },
      { label: "Constructions", key: "constructions" },
    ],
    chart: {
      title: "Commodity delivery",
      category: "construction",
      series: [
        { key: "delivered", label: "Delivered" },
        { key: "required", label: "Required" },
      ],
    },
  },
  {
    key: "systems",
    area: "intelligence",
    slug: "systems",
    title: "System intelligence",
    eyebrow: "INTELLIGENCE / EDDN",
    description:
      "EDDN system, faction, conflict, state and powerplay information.",
    endpoint: "system-summary",
    refreshMs: min,
    filters: [
      { key: "system", label: "System", placeholder: "Exact EDDN system name" },
      {
        key: "faction",
        label: "Faction present",
        param: "faction",
        placeholder: "Exact faction name",
      },
      {
        key: "controlling_faction",
        label: "Controlling faction",
        param: "controlling_faction",
        placeholder: "Exact faction name",
      },
      {
        key: "state",
        label: "Faction state",
        param: "state",
        placeholder: "War, Boom, Expansion…",
      },
      {
        key: "population",
        label: "Population",
        param: "population",
        placeholder: "Exact or range, e.g. 1000-500000",
      },
      {
        key: "power",
        label: "Power",
        param: "power",
        placeholder: "Exact power name",
      },
      {
        key: "has_conflict",
        label: "Conflict",
        type: "select",
        param: "has_conflict",
        defaultValue: "",
        options: [
          { value: "", label: "Any" },
          { value: "true", label: "Has conflict" },
        ],
      },
      {
        key: "powerplay_state",
        label: "Powerplay state",
        param: "powerplay_state",
        placeholder: "Fortified, Exploited…",
      },
    ],
    columns: [
      { key: "system", label: "System", priority: true },
      { key: "population", label: "Population", numeric: true },
      { key: "controllingFaction", label: "Controlling faction" },
      { key: "security", label: "Security" },
      { key: "factionCount", label: "Factions", numeric: true },
      { key: "conflictCount", label: "Conflicts", numeric: true },
      { key: "power", label: "Power" },
      { key: "updatedAt", label: "Updated" },
    ],
    metrics: [
      { label: "Systems", key: "systems" },
      { label: "Population", key: "population" },
      { label: "Minor factions", key: "factions" },
      { label: "Conflicts", key: "conflicts" },
    ],
  },
  {
    key: "factions-24h",
    area: "intelligence",
    slug: "factions-24h",
    title: "24h minor faction report",
    eyebrow: "INTELLIGENCE / 24H REPORT",
    description:
      "Minor factions present in systems with FSD jumps during the last 24 hours.",
    endpoint: "fsdjump-factions",
    refreshMs: min,
    filters: [
      {
        key: "system",
        label: "System",
        field: "system",
        placeholder: "Filter loaded systems",
      },
      {
        key: "faction",
        label: "Faction",
        field: "faction",
        placeholder: "Filter loaded factions",
      },
      {
        key: "state",
        label: "State",
        field: "state",
        placeholder: "Filter loaded states",
      },
    ],
    columns: [
      { key: "faction", label: "Faction", priority: true },
      { key: "system", label: "System" },
      { key: "state", label: "State" },
      { key: "influence", label: "Influence %", numeric: true },
      { key: "pending", label: "Pending" },
      { key: "recovering", label: "Recovering" },
      { key: "timestamp", label: "Timestamp" },
    ],
    metrics: [
      { label: "Factions", key: "factions" },
      { label: "Systems", key: "systems" },
      { label: "Active states", key: "states" },
      { label: "Updates", key: "updates" },
    ],
    chart: {
      title: "Faction influence",
      category: "faction",
      series: [{ key: "influence", label: "Influence" }],
    },
  },
  {
    key: "data-explorer",
    area: "admin",
    slug: "data-explorer",
    title: "Data explorer",
    eyebrow: "ADMIN / RAW DATA",
    description:
      "Server-side filtering, sorting, pagination and JSON inspection.",
    endpoint: "table/cmdr",
    refreshMs: false,
    filters: [
      {
        key: "table",
        label: "Table type",
        type: "select",
        defaultValue: "event",
        options: DATA_EXPLORER_TABLES.map((table) => ({
          value: table,
          label: dataExplorerTableLabel(table),
        })),
      },
    ],
    columns: [
      { key: "id", label: "ID", numeric: true },
      { key: "timestamp", label: "Timestamp", priority: true },
      { key: "event", label: "Event" },
      { key: "cmdr", label: "Commander" },
      { key: "system", label: "System" },
    ],
    metrics: [
      { label: "Rows", key: "rows" },
      { label: "Returned", key: "returned" },
      { label: "Page", key: "page" },
      { label: "Page size", key: "pageSize" },
    ],
    capability: "admin:read",
  },
  {
    key: "health",
    area: "admin",
    slug: "health",
    title: "Service & audit",
    eyebrow: "ADMIN / OPERATIONS",
    description:
      "Dashboard and Flask API connectivity for the selected tenant.",
    endpoint: "health",
    refreshMs: min,
    filters: [],
    columns: [
      { key: "service", label: "Service", priority: true },
      { key: "status", label: "Status" },
      { key: "version", label: "Version" },
      { key: "generatedAt", label: "Checked" },
    ],
    metrics: [
      { label: "Services healthy", key: "healthy" },
      { label: "Dashboard", key: "dashboard" },
      { label: "Flask API", key: "flask" },
      { label: "API version", key: "version" },
    ],
    capability: "admin:read",
  },
];

export function findFeature(
  area: string,
  slug: string,
): FeatureSpec | undefined {
  return features.find(
    (feature) => feature.area === area && feature.slug === slug,
  );
}

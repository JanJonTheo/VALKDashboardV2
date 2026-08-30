import type { FeatureKey } from "./features";
import {
  normalizeColonisationConstructions,
  normalizeColonisationContributionGroups,
  normalizeColonisationContributionRecords,
} from "./colonisation";

type Row = Record<string, unknown>;

interface Envelope {
  data?: unknown;
  metrics?: Record<string, string | number>;
  generated_at?: string;
  pagination?: { page: number; page_size: number; total: number };
  [key: string]: unknown;
}

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown) => String(value ?? "").trim();

const asRows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((row): row is Row => Boolean(row) && typeof row === "object")
    : [];

const unique = (rows: Row[], field: string) =>
  new Set(rows.map((row) => text(row[field])).filter(Boolean)).size;

const sum = (rows: Row[], field: string) =>
  rows.reduce((total, row) => total + number(row[field]), 0);

function parseStateNames(value: unknown): string[] {
  if (!value || value === "null") return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object"
            ? text((entry as Row).State ?? (entry as Row).state)
            : "",
      )
      .filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      return parseStateNames(JSON.parse(value));
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function humanizeConstant(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  return raw
    .replace(/^\$/, "")
    .replace(/;$/, "")
    .replace(/^government_/i, "")
    .replace(/^SYSTEM_SECURITY_/i, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeLeaderboard(row: Row, index: number): Row {
  return {
    ...row,
    position: index + 1,
    cmdr: row.cmdr,
    squadronRank: row.rank,
    buy: number(row.total_buy),
    sell: number(row.total_sell),
    profit: number(row.profit),
    profitability: number(row.profitability),
    volume: number(row.total_volume),
    quantity: number(row.total_quantity),
    missions: number(row.missions_completed),
    missionFailures: number(row.missions_failed),
    bountyVouchers: number(row.bounty_vouchers),
    combatBonds: number(row.combat_bonds),
    explorationSales: number(row.exploration_sales),
    influence: number(row.influence_eic),
    bountyFines: number(row.bounty_fines),
  };
}

function normalizeCmdr(row: Row): Row {
  return {
    ...row,
    cmdr: row.name,
    squadron: row.squadron_name,
    squadronRank: row.squadron_rank,
    combatRank: row.rank_combat,
    tradeRank: row.rank_trade,
    exploreRank: row.rank_explore,
    cqcRank: row.rank_cqc,
    empireRank: row.rank_empire,
    federationRank: row.rank_federation,
    power: row.rank_power,
  };
}

function normalizeRecruit(row: Row): Row {
  return {
    ...row,
    cmdr: row.commander ?? row.cmdr,
    lastActive: row.last_active,
    daysSinceJoin: number(row.days_since_join),
    tonnage: number(row.tonnage),
    missions: number(row.mission_count),
    bountyClaims: number(row.bounty_claims),
    exploration: number(row.exp_value),
    combatBonds: number(row.combat_bonds),
    bountyFines: number(row.bounty_fines),
    hasData: Boolean(row.has_data),
  };
}

function normalizeVoucher(row: Row): Row {
  return {
    ...row,
    cmdr: row.cmdr,
    system: row.system,
    faction: row.faction,
    redeemed: number(row.amount),
    tickId: row.tickid,
    timestamp: row.timestamp,
  };
}

function normalizeCz(row: Row): Row {
  const ground = Boolean(row.settlement);
  return {
    ...row,
    cmdr: row.cmdr,
    system: row.starsystem,
    zone: ground ? "Ground" : "Space",
    difficulty: row.cz_type,
    faction: row.faction,
    settlement: row.settlement,
    events: number(row.cz_count),
  };
}

function normalizeObjective(row: Row): Row {
  const targets = asRows(row.targets);
  const progress = targets.length
    ? targets.reduce((total, target) => total + number(target.progress), 0) /
      targets.length
    : number(row.progress);
  const endDate = text(row.enddate ?? row.due);
  const expired = endDate ? new Date(endDate).getTime() < Date.now() : false;
  return {
    ...row,
    title: row.title,
    system: row.system,
    faction: row.faction,
    progress: Number(progress.toFixed(2)),
    endDate: row.enddate ?? row.due,
    status: progress >= 100 ? "Complete" : expired ? "Expired" : "Active",
    targetCount: targets.length,
    settlementCount: targets.reduce(
      (total, target) => total + asRows(target.settlements).length,
      0,
    ),
  };
}

function normalizeColonisation(row: Row): Row {
  const delivered = number(
    row.quantity ?? row.amount ?? row.delivered ?? row.provided,
  );
  const required = number(row.required ?? row.need ?? row.target);
  return {
    ...row,
    construction:
      row.construction_name ?? row.construction ?? row.site_name ?? row.name,
    cmdr: row.cmdr,
    commodity: row.commodity_name ?? row.commodity,
    system: row.target_system ?? row.system,
    timestamp: row.timestamp,
    tickId: row.tickid,
    delivered,
    cmdrDelivered: number(row.cmdr_quantity ?? delivered),
    required,
    diff: number(row.remaining ?? Math.max(0, required - delivered)),
    status: row.status ?? row.construction_status,
  };
}

function normalizeSystem(entry: Row): Row {
  const systemInfo =
    entry.system_info && typeof entry.system_info === "object"
      ? (entry.system_info as Row)
      : entry;
  const factions = asRows(entry.factions ?? entry.minor_factions);
  const conflicts = asRows(entry.conflicts);
  const powerplays = asRows(entry.powerplays);
  const firstPowerplay = powerplays[0] ?? {};
  return {
    system: systemInfo.system_name ?? systemInfo.name,
    population: number(systemInfo.population),
    controllingFaction: systemInfo.controlling_faction,
    allegiance: systemInfo.allegiance,
    government: humanizeConstant(systemInfo.government),
    security: humanizeConstant(systemInfo.security),
    power: systemInfo.controlling_power ?? firstPowerplay.power,
    powerplayState: firstPowerplay.powerplay_state,
    factionCount: factions.length,
    conflictCount: conflicts.length,
    updatedAt: systemInfo.updated_at,
    factions,
    conflicts,
    powerplays,
    systemInfo,
  };
}

function flattenFactionReport(rows: Row[]): Row[] {
  return rows.flatMap((entry) => {
    const system = entry.StarSystem ?? entry.system;
    const timestamp = entry.Timestamp ?? entry.timestamp;
    return asRows(entry.Factions ?? entry.factions).map((faction) => ({
      system,
      timestamp,
      systemAddress: entry.SystemAddress ?? entry.system_address,
      faction: faction.Name ?? faction.name,
      allegiance: faction.Allegiance ?? faction.allegiance,
      government: faction.Government ?? faction.government,
      state: faction.FactionState ?? faction.state,
      influence: Number(
        (number(faction.Influence ?? faction.influence) * 100).toFixed(2),
      ),
      pending: parseStateNames(
        faction.PendingStates ?? faction.pending_states,
      ).join(", "),
      recovering: parseStateNames(
        faction.RecoveringStates ?? faction.recovering_states,
      ).join(", "),
      rawFaction: faction,
    }));
  });
}

function normalizeExplorer(row: Row): Row {
  return {
    ...row,
    timestamp: row.timestamp ?? row.created_at,
    event: row.event ?? row.event_type ?? row.type,
    cmdr: row.cmdr ?? row.name,
    system: row.system ?? row.starsystem,
  };
}

function monthlyRows(rows: Row[]): { data: Row[]; months: string[] } {
  const positive = [
    "total_volume",
    "profit",
    "bounty_vouchers",
    "combat_bonds",
    "exploration_sales",
    "missions_completed",
    "influence_eic",
  ];
  const negative = ["missions_failed", "bounty_fines"];
  const months = [
    ...new Set(rows.map((row) => text(row.month)).filter(Boolean)),
  ]
    .sort()
    .slice(-3);
  const scored: Row[] = rows.map((row): Row => {
    const peers = rows.filter((peer) => text(peer.month) === text(row.month));
    let score = 0;
    for (const key of positive) {
      const maximum = Math.max(
        0,
        ...peers.map((peer) => Math.max(0, number(peer[key]))),
      );
      if (maximum > 0) score += (Math.max(0, number(row[key])) / maximum) * 100;
    }
    for (const key of negative) {
      const maximum = Math.max(
        0,
        ...peers.map((peer) => Math.max(0, number(peer[key]))),
      );
      if (maximum > 0) score -= (Math.max(0, number(row[key])) / maximum) * 100;
    }
    return { ...row, contributionScore: Number(score.toFixed(2)) };
  });

  const byCmdr = new Map<string, Row>();
  for (const row of scored) {
    const cmdr = text(row.cmdr);
    if (!cmdr) continue;
    const current = byCmdr.get(cmdr) ?? {
      cmdr,
      month1: 0,
      month2: 0,
      month3: 0,
      score: 0,
      trend: "new",
    };
    const monthIndex = months.indexOf(text(row.month));
    if (monthIndex < 0) continue;
    current[`month${monthIndex + 1}`] = row.contributionScore;
    byCmdr.set(cmdr, current);
  }

  const latestIndex = months.length;
  const previousIndex = Math.max(1, latestIndex - 1);
  for (const row of byCmdr.values()) {
    const latest = number(row[`month${latestIndex}`]);
    const previous = number(row[`month${previousIndex}`]);
    row.score = latest;
    row.trend =
      latestIndex > 1
        ? `${latest - previous >= 0 ? "▲" : "▼"} ${Math.abs(latest - previous).toFixed(1)}`
        : "new";
  }

  return {
    data: [...byCmdr.values()].sort(
      (a, b) => number(b.score) - number(a.score),
    ),
    months,
  };
}

function computeMetrics(
  key: FeatureKey,
  data: Row[],
  original: Row[],
  envelope: Envelope,
) {
  switch (key) {
    case "leaderboard":
      return {
        commanders: unique(data, "cmdr"),
        profit: sum(data, "profit"),
        volume: sum(data, "volume"),
        missions: sum(data, "missions"),
      };
    case "evaluations":
      return {
        commanders: unique(data, "cmdr"),
        missions: sum(data, "missions"),
        quantity: sum(data, "quantity"),
        bountyVouchers: sum(data, "bountyVouchers"),
      };
    case "monthly-performance":
      return {
        commanders: unique(data, "cmdr"),
        topScore: Math.max(0, ...data.map((row) => number(row.score))),
        volume: sum(original, "total_volume"),
        missions: sum(original, "missions_completed"),
      };
    case "cmdrs":
      return {
        commanders: data.length,
        squadronMembers: data.filter((row) => text(row.squadron)).length,
        squadrons: unique(data, "squadron"),
        powerAligned: data.filter((row) => text(row.power)).length,
      };
    case "recruits":
      return {
        commanders: unique(data, "cmdr"),
        withData: data.filter((row) => Boolean(row.hasData)).length,
        missions: sum(data, "missions"),
        quantity: sum(data, "tonnage"),
      };
    case "vouchers":
      return {
        redeemed: sum(data, "redeemed"),
        commanders: unique(data, "cmdr"),
        transactions: data.length,
        systems: unique(data, "system"),
      };
    case "cz-summary":
      return {
        events: sum(data, "events"),
        commanders: unique(data, "cmdr"),
        systems: unique(data, "system"),
        factions: unique(data, "faction"),
      };
    case "objectives":
      return {
        objectives: data.length,
        targets: sum(data, "targetCount"),
        settlements: sum(data, "settlementCount"),
        averageProgress: data.length
          ? Number((sum(data, "progress") / data.length).toFixed(1))
          : 0,
      };
    case "colonisation": {
      const totals =
        envelope.totals && typeof envelope.totals === "object"
          ? (envelope.totals as Row)
          : {};
      return {
        delivered: number(
          totals.total_provided ?? totals.quantity ?? sum(data, "delivered"),
        ),
        required: number(totals.total_need ?? sum(data, "required")),
        commanders: number(totals.cmdr_count ?? unique(data, "cmdr")),
        constructions: number(
          totals.construction_count ?? unique(data, "construction"),
        ),
      };
    }
    case "systems":
      return {
        systems: data.length,
        population: sum(data, "population"),
        factions: sum(data, "factionCount"),
        conflicts: sum(data, "conflictCount"),
      };
    case "factions-24h":
      return {
        factions: unique(data, "faction"),
        systems: unique(data, "system"),
        states: new Set(
          data
            .map((row) => text(row.state))
            .filter((state) => state && state !== "None"),
        ).size,
        updates: data.length,
      };
    case "data-explorer":
      return {
        rows: envelope.pagination?.total ?? data.length,
        returned: data.length,
        page: envelope.pagination?.page ?? 1,
        pageSize: envelope.pagination?.page_size ?? data.length,
      };
    case "health":
      return envelope.metrics ?? {};
  }
}

export function normalizeFeaturePayload(key: FeatureKey, envelope: Envelope) {
  let original = asRows(envelope.data);
  if (key === "colonisation" && original.length === 0)
    original = asRows(envelope.records ?? envelope.rows);
  let data: Row[];
  let meta: Record<string, unknown> | undefined;

  if (key === "systems") {
    if (envelope.system_info && typeof envelope.system_info === "object") {
      original = [envelope];
    }
    data = original.map(normalizeSystem);
  } else if (key === "factions-24h") {
    data = flattenFactionReport(original);
  } else if (key === "monthly-performance") {
    const monthly = monthlyRows(original);
    data = monthly.data;
    meta = { months: monthly.months };
  } else {
    data = original.map((row, index) => {
      switch (key) {
        case "leaderboard":
        case "evaluations":
          return normalizeLeaderboard(row, index);
        case "cmdrs":
          return normalizeCmdr(row);
        case "recruits":
          return normalizeRecruit(row);
        case "vouchers":
          return normalizeVoucher(row);
        case "cz-summary":
          return normalizeCz(row);
        case "objectives":
          return normalizeObjective(row);
        case "colonisation":
          return normalizeColonisation(row);
        case "data-explorer":
          return normalizeExplorer(row);
        default:
          return row;
      }
    });
  }

  if (key === "colonisation") {
    const constructions = normalizeColonisationConstructions(
      envelope.construction_details ?? envelope.constructions,
    );
    const contributionGroups = normalizeColonisationContributionGroups(
      envelope.groups,
      constructions,
    );
    const contributionRecords = normalizeColonisationContributionRecords(
      envelope.records,
      constructions,
    );
    if (
      constructions.length ||
      contributionGroups.length ||
      contributionRecords.length
    )
      meta = {
        ...meta,
        constructions,
        contributionGroups,
        contributionRecords,
      };
  }

  const metrics = {
    ...(envelope.metrics ?? {}),
    ...computeMetrics(key, data, original, envelope),
  };
  const pagination = envelope.pagination
    ? {
        ...envelope.pagination,
        total:
          key === "monthly-performance" || key === "factions-24h"
            ? data.length
            : envelope.pagination.total,
      }
    : { page: 1, page_size: data.length, total: data.length };

  return {
    data,
    metrics,
    generated_at:
      envelope.generated_at ?? envelope.updated_at ?? new Date().toISOString(),
    pagination,
    ...(meta ? { meta } : {}),
  };
}

export const HOME_ACTIVITY_METRICS = [
  {
    key: "influence",
    label: "Influence contribution",
    color: "#e8bd52",
    unit: "points",
  },
  {
    key: "bountyVouchers",
    label: "Bounty vouchers",
    color: "#73a7cf",
    unit: "credits",
  },
  {
    key: "explorationSales",
    label: "Exploration sales",
    color: "#66c28e",
    unit: "credits",
  },
  {
    key: "combatBonds",
    label: "Combat bonds",
    color: "#e48668",
    unit: "credits",
  },
  {
    key: "tradeVolume",
    label: "Trade volume",
    color: "#a78bdb",
    unit: "credits",
  },
] as const;

export type HomeActivityMetricKey =
  (typeof HOME_ACTIVITY_METRICS)[number]["key"];

export interface HomeActivityRow {
  cmdr: string;
  influence: number;
  bountyVouchers: number;
  explorationSales: number;
  combatBonds: number;
  tradeVolume: number;
}

export interface HomeMetrics {
  activeCommanders: number;
  influence: number;
  bountyVouchers: number;
  explorationSales: number;
  combatBonds: number;
  tradeVolume: number;
  openObjectives: number;
}

export type HomeContributionMetrics = Omit<
  HomeMetrics,
  "activeCommanders" | "openObjectives"
>;

type Row = Record<string, unknown>;

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function summarizeHomeLeaderboard(rows: Row[]) {
  const activity = rows
    .map((row): HomeActivityRow => ({
      cmdr: String(row.cmdr ?? "").trim(),
      influence: nonNegativeNumber(row.influence),
      bountyVouchers: nonNegativeNumber(row.bountyVouchers),
      explorationSales: nonNegativeNumber(row.explorationSales),
      combatBonds: nonNegativeNumber(row.combatBonds),
      tradeVolume: nonNegativeNumber(row.volume),
    }))
    .filter((row) => row.cmdr.length > 0);

  const metrics: HomeContributionMetrics = {
    influence: 0,
    bountyVouchers: 0,
    explorationSales: 0,
    combatBonds: 0,
    tradeVolume: 0,
  };

  for (const row of activity) {
    for (const { key } of HOME_ACTIVITY_METRICS) metrics[key] += row[key];
  }

  return {
    activeCommanders: new Set(activity.map((row) => row.cmdr)).size,
    metrics,
    activity,
  };
}

export function contributionPercentage(value: unknown, total: unknown) {
  const safeValue = nonNegativeNumber(value);
  const safeTotal = nonNegativeNumber(total);
  if (safeTotal === 0) return 0;
  return (safeValue / safeTotal) * 100;
}

const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function getTickSchedule(lastTick: unknown) {
  if (typeof lastTick !== "string" || !lastTick.trim()) {
    return { lastTick: null, estimatedNextTick: null };
  }

  const parsedLastTick = new Date(lastTick);
  if (Number.isNaN(parsedLastTick.getTime())) {
    return { lastTick: null, estimatedNextTick: null };
  }

  return {
    lastTick: parsedLastTick,
    estimatedNextTick: new Date(parsedLastTick.getTime() + TICK_INTERVAL_MS),
  };
}

export function formatTickCountdown(nextTick: Date | null, now = Date.now()) {
  const nextTickTime = nextTick?.getTime();
  if (nextTickTime === undefined || !Number.isFinite(nextTickTime)) return "—";

  if (now > nextTickTime) {
    const overdueMinutes = Math.ceil((now - nextTickTime) / (60 * 1000));
    return `Overdue (-${overdueMinutes} Minutes)`;
  }

  const remainingMinutes = Math.max(
    0,
    Math.ceil((nextTickTime - now) / (60 * 1000)),
  );
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

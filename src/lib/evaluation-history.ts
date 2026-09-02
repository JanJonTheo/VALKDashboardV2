import type { LeaderboardMetric } from "./preferences";

export type EvaluationHistoryGranularity = "hour" | "day" | "month";

export interface EvaluationHistoryBucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface EvaluationHistoryRange {
  start: string;
  end: string;
  label: string;
  granularity: EvaluationHistoryGranularity;
  buckets: EvaluationHistoryBucket[];
}

export interface EvaluationHistoryRow {
  bucket: string;
  cmdr: string;
  value: number;
}

export interface EvaluationHistorySeries {
  name: string;
  data: number[];
  total: number;
}

export interface EvaluationHistoryPayload {
  metric: LeaderboardMetric;
  limit: number;
  range: Omit<EvaluationHistoryRange, "buckets">;
  buckets: Array<Pick<EvaluationHistoryBucket, "key" | "label">>;
  series: EvaluationHistorySeries[];
  generated_at: string;
}

interface EvaluationHistoryRangeInput {
  period: string;
  now?: Date;
  lastTick?: string | null;
  fromDate?: string;
  toDate?: string;
  fromMonth?: string;
  toMonth?: string;
}

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const maximumBuckets = 120;

function utcDate(year: number, month: number, day = 1) {
  return new Date(Date.UTC(year, month, day));
}

function startOfUtcDay(value: Date) {
  return utcDate(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

function startOfUtcMonth(value: Date) {
  return utcDate(value.getUTCFullYear(), value.getUTCMonth());
}

function addUtcMonths(value: Date, amount: number) {
  return utcDate(value.getUTCFullYear(), value.getUTCMonth() + amount);
}

function startOfUtcWeek(value: Date) {
  const day = startOfUtcDay(value);
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - mondayOffset * dayMs);
}

function parseDateOnly(value: string | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = utcDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function parseMonth(value: string | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const date = utcDate(Number(match[1]), Number(match[2]) - 1);
  return date.toISOString().slice(0, 7) === value ? date : null;
}

function bucketLabel(
  value: Date,
  granularity: EvaluationHistoryGranularity,
  period: string,
) {
  if (granularity === "hour") {
    const time = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(value);
    if (["cd", "ld", "date-range"].includes(period)) return time;
    const date = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(value);
    return `${date}, ${time}`;
  }
  if (granularity === "day")
    return new Intl.DateTimeFormat("en-GB", {
      weekday: ["cw", "lw"].includes(period) ? "short" : undefined,
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(value);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function addBucket(value: Date, granularity: EvaluationHistoryGranularity) {
  if (granularity === "hour") return new Date(value.getTime() + hourMs);
  if (granularity === "day") return new Date(value.getTime() + dayMs);
  return addUtcMonths(value, 1);
}

function makeBuckets(
  start: Date,
  end: Date,
  granularity: EvaluationHistoryGranularity,
  period: string,
) {
  const buckets: EvaluationHistoryBucket[] = [];
  let cursor = start;
  while (cursor < end) {
    if (buckets.length >= maximumBuckets)
      throw new Error("The selected history range contains too many buckets");
    const next = addBucket(cursor, granularity);
    const bucketEnd = next < end ? next : end;
    buckets.push({
      key: String(buckets.length),
      label: bucketLabel(cursor, granularity, period),
      start: cursor.toISOString(),
      end: bucketEnd.toISOString(),
    });
    cursor = next;
  }
  return buckets;
}

function customDateRange(input: EvaluationHistoryRangeInput) {
  const start = parseDateOnly(input.fromDate);
  const selectedEnd = parseDateOnly(input.toDate);
  if (!start || !selectedEnd || start > selectedEnd)
    throw new Error("Choose a valid custom date range");
  const end = new Date(selectedEnd.getTime() + dayMs);
  const days = (end.getTime() - start.getTime()) / dayMs;
  const granularity: EvaluationHistoryGranularity =
    days <= 2 ? "hour" : days <= 93 ? "day" : "month";
  return { start, end, granularity };
}

function customMonthRange(input: EvaluationHistoryRangeInput) {
  const start = parseMonth(input.fromMonth);
  const selectedEnd = parseMonth(input.toMonth);
  if (!start || !selectedEnd || start > selectedEnd)
    throw new Error("Choose a valid custom month range");
  return {
    start,
    end: addUtcMonths(selectedEnd, 1),
    granularity: "month" as const,
  };
}

export function evaluationHistoryRange(
  input: EvaluationHistoryRangeInput,
): EvaluationHistoryRange {
  const now =
    input.now && !Number.isNaN(input.now.getTime()) ? input.now : new Date();
  const today = startOfUtcDay(now);
  const currentMonth = startOfUtcMonth(now);
  let start: Date;
  let end: Date;
  let granularity: EvaluationHistoryGranularity;

  switch (input.period) {
    case "ct":
    case "lt": {
      const parsedTick = input.lastTick ? new Date(input.lastTick) : now;
      const currentTick = Number.isNaN(parsedTick.getTime()) ? now : parsedTick;
      start =
        input.period === "ct"
          ? currentTick
          : new Date(currentTick.getTime() - dayMs);
      end =
        input.period === "ct"
          ? new Date(currentTick.getTime() + dayMs)
          : currentTick;
      granularity = "hour";
      break;
    }
    case "cd":
      start = today;
      end = new Date(today.getTime() + dayMs);
      granularity = "hour";
      break;
    case "ld":
      start = new Date(today.getTime() - dayMs);
      end = today;
      granularity = "hour";
      break;
    case "cw":
      start = startOfUtcWeek(now);
      end = new Date(start.getTime() + 7 * dayMs);
      granularity = "day";
      break;
    case "lw":
      end = startOfUtcWeek(now);
      start = new Date(end.getTime() - 7 * dayMs);
      granularity = "day";
      break;
    case "cm":
      start = currentMonth;
      end = addUtcMonths(currentMonth, 1);
      granularity = "day";
      break;
    case "lm":
      end = currentMonth;
      start = addUtcMonths(currentMonth, -1);
      granularity = "day";
      break;
    case "2m":
      end = currentMonth;
      start = addUtcMonths(currentMonth, -2);
      granularity = "month";
      break;
    case "y":
      start = utcDate(now.getUTCFullYear(), 0);
      end = utcDate(now.getUTCFullYear() + 1, 0);
      granularity = "month";
      break;
    case "date-range":
      ({ start, end, granularity } = customDateRange(input));
      break;
    case "month-range":
      ({ start, end, granularity } = customMonthRange(input));
      break;
    case "all":
    default:
      start = addUtcMonths(currentMonth, -11);
      end = addUtcMonths(currentMonth, 1);
      granularity = "month";
      break;
  }

  const buckets = makeBuckets(start, end, granularity, input.period);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)} UTC`,
    granularity,
    buckets,
  };
}

export function evaluationHistorySeries(
  rows: EvaluationHistoryRow[],
  buckets: EvaluationHistoryBucket[],
  limit: number,
): EvaluationHistorySeries[] {
  const bucketKeys = new Set(buckets.map((bucket) => bucket.key));
  const values = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const cmdr = String(row.cmdr ?? "").trim();
    const bucket = String(row.bucket ?? "");
    const value = Number(row.value);
    if (!cmdr || !bucketKeys.has(bucket) || !Number.isFinite(value)) continue;
    const commander = values.get(cmdr) ?? new Map<string, number>();
    commander.set(bucket, (commander.get(bucket) ?? 0) + value);
    values.set(cmdr, commander);
  }

  return [...values]
    .map(([name, commander]) => ({
      name,
      data: buckets.map((bucket) => commander.get(bucket.key) ?? 0),
      total: [...commander.values()].reduce((sum, value) => sum + value, 0),
    }))
    .sort(
      (left, right) =>
        right.total - left.total || left.name.localeCompare(right.name, "en"),
    )
    .slice(0, Math.max(1, limit));
}

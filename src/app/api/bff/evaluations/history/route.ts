import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  evaluationHistoryRange,
  evaluationHistorySeries,
  type EvaluationHistoryRow,
} from "@/lib/evaluation-history";
import { evaluationHistoryQuery } from "@/lib/evaluation-history-server";
import { getLastGalaxyTick } from "@/lib/galaxy-tick";
import {
  leaderboardMetricOptions,
  type LeaderboardMetric,
} from "@/lib/preferences";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { getTenantById } from "@/lib/tenant-config";

export const runtime = "nodejs";

const querySchema = z.object({
  period: z
    .enum([
      "ct",
      "lt",
      "cd",
      "ld",
      "cw",
      "lw",
      "cm",
      "lm",
      "2m",
      "y",
      "all",
      "date-range",
      "month-range",
    ])
    .default("all"),
  metric: z
    .enum(leaderboardMetricOptions.map((option) => option.value))
    .default("missions"),
  mode: z.enum(["full", "top5"]).default("full"),
  commander: z.string().trim().max(100).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  from_month: z.string().optional(),
  to_month: z.string().optional(),
});

function errorResponse(error: unknown) {
  const status = error instanceof AccessError ? error.status : 502;
  return NextResponse.json(
    {
      error: {
        code:
          status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : "EVALUATION_HISTORY_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Evaluation history is unavailable",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function latestDatabaseTick(database: Database.Database): string | null {
  const row = database
    .prepare(
      `SELECT MIN(timestamp) AS start
       FROM event
       WHERE tickid = (
         SELECT tickid
         FROM event
         WHERE tickid IS NOT NULL
         GROUP BY tickid
         ORDER BY MAX(timestamp) DESC
         LIMIT 1
       )`,
    )
    .get() as { start?: unknown } | undefined;
  const value = String(row?.start ?? "").trim();
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

function demoRows(
  metric: LeaderboardMetric,
  bucketCount: number,
): EvaluationHistoryRow[] {
  const commanders = [
    "Valkyrie",
    "Astra Nyx",
    "Rooke",
    "Kael Voss",
    "Lyra Dawn",
    "Orion Pax",
    "Sable",
    "Nova Kade",
    "Torvyr",
    "Rhea Sol",
  ];
  const scale = ["missions", "missionFailures", "influence"].includes(metric)
    ? 1
    : 100_000;
  return commanders.flatMap((cmdr, commanderIndex) =>
    Array.from({ length: bucketCount }, (_, bucketIndex) => ({
      bucket: String(bucketIndex),
      cmdr,
      value:
        Math.max(
          0,
          Math.round(
            (12 - commanderIndex) *
              (1 + Math.sin((bucketIndex + commanderIndex) / 2)) *
              scale,
          ),
        ) || (commanderIndex < 5 ? scale : 0),
    })),
  );
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_EVALUATION_HISTORY_QUERY",
          message: parsed.error.issues[0]?.message ?? "Invalid history query",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );

  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch (error) {
    return errorResponse(error);
  }

  const lastTick = ["ct", "lt"].includes(parsed.data.period)
    ? await getLastGalaxyTick()
    : null;
  let range;
  try {
    range = evaluationHistoryRange({
      period: parsed.data.period,
      lastTick,
      fromDate: parsed.data.from_date,
      toDate: parsed.data.to_date,
      fromMonth: parsed.data.from_month,
      toMonth: parsed.data.to_month,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_EVALUATION_HISTORY_RANGE",
          message:
            error instanceof Error ? error.message : "Invalid history range",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const limit = parsed.data.mode === "top5" ? 5 : 10;
    const isDemo =
      !process.env.FLASK_API_BASE_URL || process.env.VALK_DEMO_MODE === "true";
    let rows: EvaluationHistoryRow[];
    let effectiveRange = range;

    if (isDemo) {
      rows = demoRows(parsed.data.metric, range.buckets.length);
    } else {
      const tenant = await getTenantById(session.tenant.id);
      if (!tenant?.databasePath)
        throw new Error("The selected tenant database is unavailable");
      const database = new Database(tenant.databasePath, { readonly: true });
      try {
        database.pragma("query_only = ON");
        database.pragma("busy_timeout = 5000");
        if (["ct", "lt"].includes(parsed.data.period) && !lastTick) {
          effectiveRange = evaluationHistoryRange({
            period: parsed.data.period,
            lastTick: latestDatabaseTick(database),
          });
        }
        const query = evaluationHistoryQuery(
          parsed.data.metric,
          effectiveRange.buckets,
          tenant.factionName,
        );
        rows = database
          .prepare(query.sql)
          .all(query.parameters) as EvaluationHistoryRow[];
      } finally {
        database.close();
      }
    }

    const commander = parsed.data.commander?.toLocaleLowerCase("en");
    if (commander)
      rows = rows.filter((row) =>
        String(row.cmdr).toLocaleLowerCase("en").includes(commander),
      );
    return NextResponse.json(
      {
        metric: parsed.data.metric,
        limit,
        range: {
          start: effectiveRange.start,
          end: effectiveRange.end,
          label: effectiveRange.label,
          granularity: effectiveRange.granularity,
        },
        buckets: effectiveRange.buckets.map(({ key, label }) => ({
          key,
          label,
        })),
        series: evaluationHistorySeries(rows, effectiveRange.buckets, limit),
        generated_at: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

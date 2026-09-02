import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { getLastGalaxyTick } from "@/lib/galaxy-tick";
import { summarizeHomeLeaderboard } from "@/lib/home";
import { normalizeFeaturePayload } from "@/lib/normalize";
import { AccessError, requireDashboardSession } from "@/lib/session";

type Row = Record<string, unknown>;

function requestWithQuery(request: Request, query: Record<string, string>) {
  const url = new URL(request.url);
  url.search = new URLSearchParams(query).toString();
  return new Request(url, { headers: request.headers });
}

async function rows(response: Response): Promise<Row[]> {
  if (!response.ok)
    throw new Error(`Tenant API returned HTTP ${response.status}`);
  const body = (await response.json()) as { data?: unknown };
  return Array.isArray(body.data) ? (body.data as Row[]) : [];
}

export async function GET(request: Request) {
  const correlation = crypto.randomUUID();
  try {
    const session = await requireDashboardSession();
    const demo =
      !process.env.FLASK_API_BASE_URL || process.env.VALK_DEMO_MODE === "true";
    if (demo) {
      const lastTick = await getLastGalaxyTick();
      return NextResponse.json({
        metrics: {
          activeCommanders: 3,
          influence: 126,
          bountyVouchers: 184_200_000,
          explorationSales: 114_000_000,
          combatBonds: 123_000_000,
          tradeVolume: 720_000_000,
          openObjectives: 6,
        },
        activity: [
          {
            cmdr: "Valkyrie",
            influence: 64,
            bountyVouchers: 80_000_000,
            explorationSales: 24_000_000,
            combatBonds: 42_000_000,
            tradeVolume: 210_000_000,
          },
          {
            cmdr: "Astra Nyx",
            influence: 38,
            bountyVouchers: 56_000_000,
            explorationSales: 75_000_000,
            combatBonds: 18_000_000,
            tradeVolume: 340_000_000,
          },
          {
            cmdr: "Rooke",
            influence: 24,
            bountyVouchers: 48_200_000,
            explorationSales: 15_000_000,
            combatBonds: 63_000_000,
            tradeVolume: 170_000_000,
          },
        ],
        objectives: [],
        generated_at: new Date().toISOString(),
        last_tick: lastTick,
        tenant: session.tenant.name,
      });
    }

    const [leaderboardResponse, objectiveResponse, lastTick] =
      await Promise.all([
        flaskRequest(
          "summary/leaderboard",
          requestWithQuery(request, { period: "ct" }),
          session,
        ),
        flaskRequest(
          "objectives",
          requestWithQuery(request, { active: "true" }),
          session,
        ),
        getLastGalaxyTick(),
      ]);

    const [leaderboard, objectives] = await Promise.all([
      rows(leaderboardResponse),
      rows(objectiveResponse),
    ]);
    const normalizedLeaderboard = normalizeFeaturePayload("leaderboard", {
      data: leaderboard,
    }).data;
    const homeLeaderboard = summarizeHomeLeaderboard(normalizedLeaderboard);
    const normalizedObjectives = normalizeFeaturePayload("objectives", {
      data: objectives,
    }).data;

    return NextResponse.json(
      {
        metrics: {
          activeCommanders: homeLeaderboard.activeCommanders,
          ...homeLeaderboard.metrics,
          openObjectives: normalizedObjectives.length,
        },
        activity: homeLeaderboard.activity,
        objectives: normalizedObjectives.slice(0, 3),
        generated_at: new Date().toISOString(),
        last_tick: lastTick,
        tenant: session.tenant.name,
      },
      { headers: { "x-correlation-id": correlation } },
    );
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code: status === 401 ? "UNAUTHENTICATED" : "UPSTREAM_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Dashboard home is unavailable",
          correlation_id: correlation,
        },
        generated_at: new Date().toISOString(),
      },
      { status },
    );
  }
}

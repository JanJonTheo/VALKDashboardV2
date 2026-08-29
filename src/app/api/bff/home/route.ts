import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { normalizeFeaturePayload } from "@/lib/normalize";
import { AccessError, requireDashboardSession } from "@/lib/session";

type Row = Record<string, unknown>;

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
      return NextResponse.json({
        metrics: {
          activeCommanders: 8,
          influence: 126,
          bountyVouchers: 184_200_000,
          openObjectives: 6,
        },
        activity: [
          { cmdr: "Valkyrie", actions: 32 },
          { cmdr: "Astra Nyx", actions: 24 },
          { cmdr: "Rooke", actions: 18 },
        ],
        objectives: [],
        generated_at: new Date().toISOString(),
        tenant: session.tenant.name,
      });
    }

    const [leaderboardResponse, voucherResponse, objectiveResponse] =
      await Promise.all([
        flaskRequest(
          "summary/leaderboard",
          requestWithQuery(request, { period: "ct" }),
          session,
        ),
        flaskRequest(
          "bounty-vouchers",
          requestWithQuery(request, { period: "ct" }),
          session,
        ),
        flaskRequest(
          "objectives",
          requestWithQuery(request, { active: "true" }),
          session,
        ),
      ]);

    const [leaderboard, vouchers, objectives] = await Promise.all([
      rows(leaderboardResponse),
      rows(voucherResponse),
      rows(objectiveResponse),
    ]);
    const normalizedObjectives = normalizeFeaturePayload("objectives", {
      data: objectives,
    }).data;
    const activeCommanders = new Set(
      leaderboard.map((row) => String(row.cmdr ?? "").trim()).filter(Boolean),
    ).size;

    return NextResponse.json(
      {
        metrics: {
          activeCommanders,
          influence: leaderboard.reduce(
            (total, row) => total + number(row.influence_eic),
            0,
          ),
          bountyVouchers: vouchers.reduce(
            (total, row) => total + number(row.amount),
            0,
          ),
          openObjectives: normalizedObjectives.length,
        },
        activity: leaderboard.map((row) => ({
          cmdr: row.cmdr,
          actions:
            number(row.missions_completed) +
            number(row.missions_failed) +
            number(row.influence_eic),
          missions: number(row.missions_completed),
          influence: number(row.influence_eic),
        })),
        objectives: normalizedObjectives.slice(0, 3),
        generated_at: new Date().toISOString(),
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

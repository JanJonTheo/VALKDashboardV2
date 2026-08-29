import { NextResponse } from "next/server";
import { features, type FeatureSpec } from "@/lib/features";
import { mockPayload } from "@/lib/mock-data";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { normalizeFeaturePayload } from "@/lib/normalize";

function specFor(key: string) {
  return features.find((feature) => feature.key === key);
}

function demo() {
  return (
    !process.env.FLASK_API_BASE_URL || process.env.VALK_DEMO_MODE === "true"
  );
}

function errorResponse(error: unknown, correlation: string) {
  const status = error instanceof AccessError ? error.status : 502;
  const message =
    error instanceof Error ? error.message : "Unexpected dashboard error";
  return NextResponse.json(
    {
      error: {
        code:
          status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : "UPSTREAM_ERROR",
        message,
        correlation_id: correlation,
      },
      generated_at: new Date().toISOString(),
    },
    { status },
  );
}

function upstreamRequest(request: Request, spec: FeatureSpec) {
  const incoming = new URL(request.url);
  const upstream = new URL(request.url);
  upstream.search = "";

  for (const filter of spec.filters) {
    if (!filter.param) continue;
    const value =
      incoming.searchParams.get(filter.key)?.trim() || filter.defaultValue;
    if (value) upstream.searchParams.set(filter.param, value);
  }

  if (spec.key === "leaderboard") {
    const fromMonth = incoming.searchParams.get("from_month");
    const toMonth = incoming.searchParams.get("to_month");
    if (fromMonth && /^\d{4}-\d{2}$/.test(fromMonth))
      upstream.searchParams.set("from_date", `${fromMonth}-01`);
    if (toMonth && /^\d{4}-\d{2}$/.test(toMonth)) {
      const [year, month] = toMonth.split("-").map(Number);
      upstream.searchParams.set(
        "to_date",
        new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
      );
    }
    if (
      incoming.searchParams.get("period") === "date-range" ||
      incoming.searchParams.get("period") === "month-range"
    )
      upstream.searchParams.delete("period");
  }

  if (spec.key === "data-explorer") {
    for (const key of ["page", "page_size", "sort", "direction", "filters"]) {
      const value = incoming.searchParams.get(key);
      if (value) upstream.searchParams.set(key, value);
    }
  }

  if (spec.key === "monthly-performance") {
    const now = new Date();
    const currentMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const from = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() - 3,
        1,
      ),
    );
    const to = new Date(currentMonth.getTime() - 86_400_000);
    upstream.searchParams.set("from_date", from.toISOString().slice(0, 10));
    upstream.searchParams.set("to_date", to.toISOString().slice(0, 10));
    upstream.searchParams.set("group_by", "month");
  }

  if (
    spec.key === "colonisation" &&
    !["constructions", "commodities"].includes(
      incoming.searchParams.get("view") ?? "",
    )
  ) {
    upstream.searchParams.set("group_by", "cmdr");
  }

  return new Request(upstream, {
    method: request.method,
    headers: request.headers,
  });
}

async function healthPayload(
  request: Request,
  session: Awaited<ReturnType<typeof requireDashboardSession>>,
) {
  const generatedAt = new Date().toISOString();
  const response = await flaskRequest("../discovery", request, session);
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const flaskHealthy = response.ok;
  const dashboardVersion = process.env.npm_package_version ?? "0.1.0";
  const flaskVersion = typeof body.version === "string" ? body.version : "—";
  return {
    data: [
      {
        service: "VALK Dashboard V2",
        status: "Healthy",
        version: dashboardVersion,
        generatedAt,
      },
      {
        service: "VALK Flask API",
        status: flaskHealthy ? "Healthy" : `HTTP ${response.status}`,
        version: flaskVersion,
        generatedAt,
      },
    ],
    metrics: {
      healthy: flaskHealthy ? "2 / 2" : "1 / 2",
      dashboard: "Healthy",
      flask: flaskHealthy ? "Healthy" : `HTTP ${response.status}`,
      version: flaskVersion,
    },
    generated_at: generatedAt,
    pagination: { page: 1, page_size: 2, total: 2 },
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ feature: string }> },
) {
  const correlation = crypto.randomUUID();
  try {
    const { feature } = await params;
    const spec = specFor(feature);
    if (!spec) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Unknown dashboard feature",
            correlation_id: correlation,
          },
        },
        { status: 404 },
      );
    }

    const session = await requireDashboardSession(spec.capability);
    if (demo()) {
      return NextResponse.json(mockPayload(spec.key), {
        headers: { "x-correlation-id": correlation },
      });
    }

    const upstream = upstreamRequest(request, spec);
    const query = new URL(request.url).searchParams;

    if (spec.key === "health") {
      return NextResponse.json(await healthPayload(upstream, session), {
        headers: { "x-correlation-id": correlation },
      });
    }

    if (spec.key === "systems") {
      const system = query.get("system")?.trim();
      const hasServerFilter = spec.filters.some(
        (filter) => filter.param && query.get(filter.key)?.trim(),
      );
      if (!system && !hasServerFilter) {
        return NextResponse.json(
          normalizeFeaturePayload("systems", {
            data: [],
            generated_at: new Date().toISOString(),
          }),
          { headers: { "x-correlation-id": correlation } },
        );
      }
    }

    let endpoint = spec.endpoint;
    if (spec.key === "cz-summary" && query.get("type") === "ground") {
      endpoint = "syntheticgroundcz-summary";
    } else if (
      spec.key === "colonisation" &&
      ["constructions", "commodities"].includes(query.get("view") ?? "")
    ) {
      endpoint = "colonisation/constructions";
    } else if (spec.key === "systems" && query.get("system")?.trim()) {
      endpoint = `system-summary/${encodeURIComponent(query.get("system")!.trim())}`;
    } else if (spec.key === "data-explorer") {
      const table = query.get("table")?.trim() || "cmdr";
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_TABLE",
              message:
                "Table names may only contain letters, numbers and underscores",
              correlation_id: correlation,
            },
          },
          { status: 400 },
        );
      }
      endpoint = `table/${table}`;
    }

    const response = await flaskRequest(endpoint, upstream, session);
    if (!response.ok) return response;
    const envelope = (await response.json()) as Record<string, unknown>;
    return NextResponse.json(normalizeFeaturePayload(spec.key, envelope), {
      status: response.status,
      headers: {
        "x-correlation-id":
          response.headers.get("x-correlation-id") ?? correlation,
      },
    });
  } catch (error) {
    return errorResponse(error, correlation);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ feature: string }> },
) {
  const correlation = crypto.randomUUID();
  try {
    const { feature } = await params;
    const spec = specFor(feature);
    if (!spec) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Unknown dashboard feature",
            correlation_id: correlation,
          },
        },
        { status: 404 },
      );
    }
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as {
      action?: string;
      title?: string;
      system?: string;
      target?: number;
      due?: string;
      notes?: string;
      monthly_data?: unknown[];
    };
    const capability = body.action?.includes("discord-report")
      ? "reports:send"
      : body.action?.includes("ai-assessment")
        ? "assessment:run"
        : feature === "objectives"
          ? "objectives:write"
          : spec.capability;
    const session = await requireDashboardSession(capability);
    if (demo()) {
      return NextResponse.json(
        {
          ok: true,
          audit: {
            tenant: session.tenant.id,
            user: session.user.id,
            role: session.role,
            action: body.action ?? "write",
            correlation_id: correlation,
            timestamp: new Date().toISOString(),
          },
        },
        { headers: { "x-correlation-id": correlation } },
      );
    }
    const endpoint = body.action?.includes("discord-report")
      ? "summary/discord/report"
      : body.action?.includes("ai-assessment")
        ? "summary/monthly-performance/assessment"
        : spec.endpoint;
    const upstreamBody = body.action?.includes("discord-report")
      ? { page: "evaluations", mode: "full" }
      : body.action?.includes("ai-assessment")
        ? { monthly_data: body.monthly_data ?? [] }
        : body.action === "create"
          ? {
              title: body.title,
              system: body.system,
              enddate: body.due,
              description: body.notes,
              targets: [
                {
                  type: "overall",
                  system: body.system,
                  targetoverall: body.target,
                  progress: 0,
                },
              ],
            }
          : body;
    const upstream = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(upstreamBody),
    });
    return flaskRequest(endpoint, upstream, session);
  } catch (error) {
    return errorResponse(error, correlation);
  }
}

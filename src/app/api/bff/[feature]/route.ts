import { NextResponse } from "next/server";
import {
  collectExplorerFilterOptions,
  EVENT_TABLE_COLUMNS,
  isDataExplorerTable,
  orderExplorerColumns,
  type DataExplorerRow,
} from "@/lib/data-explorer";
import { features, periodOptions, type FeatureSpec } from "@/lib/features";
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

interface FeatureActionBody {
  action?: string;
  title?: string;
  system?: string;
  target?: number;
  due?: string;
  notes?: string;
  monthly_data?: unknown[];
  period?: string;
  mode?: string;
  from_date?: string;
  to_date?: string;
  from_month?: string;
  to_month?: string;
}

const reportPresetPeriods = new Set(
  periodOptions
    .map((option) => option.value)
    .filter((period) => period !== "date-range" && period !== "month-range"),
);

class InvalidActionError extends Error {}

function isDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isMonth(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function discordReportPayload(body: FeatureActionBody) {
  const payload: Record<string, string> = {
    page: "evaluations",
    mode: body.mode === "top5" ? "top5" : "full",
  };

  if (body.period === "date-range") {
    if (!isDate(body.from_date) || !isDate(body.to_date))
      throw new InvalidActionError(
        "A complete date range is required for the Discord report",
      );
    payload.from_date = body.from_date!;
    payload.to_date = body.to_date!;
    return payload;
  }

  if (body.period === "month-range") {
    if (!isMonth(body.from_month) || !isMonth(body.to_month))
      throw new InvalidActionError(
        "A complete month range is required for the Discord report",
      );
    payload.from_date = `${body.from_month}-01`;
    const [year, month] = body.to_month!.split("-").map(Number);
    payload.to_date = new Date(Date.UTC(year, month, 0))
      .toISOString()
      .slice(0, 10);
    payload.group_by = "month";
    return payload;
  }

  payload.period = reportPresetPeriods.has(body.period ?? "")
    ? body.period!
    : "all";
  return payload;
}

function errorResponse(error: unknown, correlation: string) {
  const status =
    error instanceof AccessError
      ? error.status
      : error instanceof InvalidActionError
        ? 400
        : 502;
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
              : status === 400
                ? "INVALID_ACTION"
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

  if (["leaderboard", "evaluations"].includes(spec.key)) {
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

  if (spec.key === "colonisation") {
    const view = incoming.searchParams.get("view") ?? "contributions";
    if (!["constructions", "commodities"].includes(view)) {
      upstream.searchParams.set(
        "group_by",
        view === "contribution-events" ? "construction" : "cmdr",
      );
    }
    const fromDate = incoming.searchParams.get("from_date")?.trim();
    const toDate = incoming.searchParams.get("to_date")?.trim();
    if (fromDate || toDate) {
      upstream.searchParams.set("period", "custom");
      if (!fromDate && toDate) upstream.searchParams.set("from", toDate);
      if (fromDate && !toDate) upstream.searchParams.set("to", fromDate);
    } else if (incoming.searchParams.get("period") === "date-range") {
      upstream.searchParams.set("period", "all");
    }
  }

  return new Request(upstream, {
    method: request.method,
    headers: request.headers,
  });
}

const explorerPageSize = 250;
const explorerConcurrency = 6;

function explorerRows(envelope: Record<string, unknown>): DataExplorerRow[] {
  return Array.isArray(envelope.data)
    ? (envelope.data.filter(
        (row): row is DataExplorerRow =>
          Boolean(row) && typeof row === "object" && !Array.isArray(row),
      ) as DataExplorerRow[])
    : [];
}

function explorerTotal(
  envelope: Record<string, unknown>,
  fallback: number,
): number {
  const pagination = envelope.pagination;
  if (!pagination || typeof pagination !== "object") return fallback;
  const total = Number((pagination as Record<string, unknown>).total);
  return Number.isFinite(total) && total >= 0 ? total : fallback;
}

function explorerPageRequest(
  request: Request,
  spec: FeatureSpec,
  page: number,
) {
  const url = new URL(request.url);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(explorerPageSize));
  url.searchParams.delete("scope");
  url.searchParams.delete("options");
  return upstreamRequest(
    new Request(url, { method: "GET", headers: request.headers }),
    spec,
  );
}

async function loadExplorerRows(
  request: Request,
  spec: FeatureSpec,
  endpoint: string,
  session: Awaited<ReturnType<typeof requireDashboardSession>>,
): Promise<
  | {
      ok: true;
      rows: DataExplorerRow[];
      generatedAt: string;
      correlation: string | null;
    }
  | { ok: false; response: Response }
> {
  const loadPage = async (page: number) => {
    const response = await flaskRequest(
      endpoint,
      explorerPageRequest(request, spec, page),
      session,
    );
    if (!response.ok) return { ok: false as const, response };
    const envelope = (await response.json()) as Record<string, unknown>;
    return {
      ok: true as const,
      envelope,
      rows: explorerRows(envelope),
      correlation: response.headers.get("x-correlation-id"),
    };
  };

  const first = await loadPage(1);
  if (!first.ok) return first;
  const rows = [...first.rows];
  const total = explorerTotal(first.envelope, rows.length);
  const pages = Math.ceil(total / explorerPageSize);
  for (let start = 2; start <= pages; start += explorerConcurrency) {
    const pageNumbers = Array.from(
      { length: Math.min(explorerConcurrency, pages - start + 1) },
      (_, index) => start + index,
    );
    const batch = await Promise.all(pageNumbers.map(loadPage));
    const failure = batch.find((result) => !result.ok);
    if (failure && !failure.ok) return failure;
    for (const result of batch) {
      if (result.ok) rows.push(...result.rows);
    }
  }
  return {
    ok: true,
    rows,
    generatedAt:
      typeof first.envelope.generated_at === "string"
        ? first.envelope.generated_at
        : new Date().toISOString(),
    correlation: first.correlation,
  };
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
      const table = query.get("table")?.trim() || "event";
      if (!isDataExplorerTable(table)) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_TABLE",
              message: "The selected table is not available in Data explorer",
              correlation_id: correlation,
            },
          },
          { status: 400 },
        );
      }
      endpoint = `table/${table}`;
    }

    if (
      spec.key === "data-explorer" &&
      (query.get("scope") === "all" || query.get("options") === "1")
    ) {
      const table = query.get("table")?.trim() || "event";
      const result = await loadExplorerRows(request, spec, endpoint, session);
      if (!result.ok) return result.response;
      const columns = orderExplorerColumns(
        [
          ...(table === "event" ? EVENT_TABLE_COLUMNS : []),
          ...result.rows.flatMap((row) => Object.keys(row)),
        ],
        table,
      );
      if (query.get("options") === "1") {
        return NextResponse.json(
          {
            data: [],
            metrics: {
              rows: result.rows.length,
              returned: 0,
              page: 1,
              pageSize: explorerPageSize,
            },
            generated_at: result.generatedAt,
            pagination: {
              page: 1,
              page_size: explorerPageSize,
              total: result.rows.length,
            },
            meta: {
              columns,
              filter_options: collectExplorerFilterOptions(result.rows),
            },
          },
          {
            headers: {
              "x-correlation-id": result.correlation ?? correlation,
            },
          },
        );
      }
      const normalized = normalizeFeaturePayload("data-explorer", {
        data: result.rows,
        generated_at: result.generatedAt,
        pagination: {
          page: 1,
          page_size: result.rows.length || explorerPageSize,
          total: result.rows.length,
        },
      });
      return NextResponse.json(
        { ...normalized, meta: { columns } },
        {
          headers: {
            "x-correlation-id": result.correlation ?? correlation,
          },
        },
      );
    }

    const isColonisationContributionEndpoint =
      spec.key === "colonisation" && endpoint === "colonisation/contributions";
    const [response, constructionResponse] = await Promise.all([
      flaskRequest(endpoint, upstream, session),
      isColonisationContributionEndpoint
        ? flaskRequest(
            "colonisation/constructions",
            new Request(upstream),
            session,
          )
        : Promise.resolve(null),
    ]);
    if (!response.ok) return response;
    const envelope = (await response.json()) as Record<string, unknown>;
    if (constructionResponse?.ok) {
      const constructionEnvelope =
        (await constructionResponse.json()) as Record<string, unknown>;
      envelope.construction_details = constructionEnvelope.constructions;
    }
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
      .catch(() => ({}))) as FeatureActionBody;
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
      ? discordReportPayload(body)
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

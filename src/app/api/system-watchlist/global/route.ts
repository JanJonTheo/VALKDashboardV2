import Database from "better-sqlite3";
import { isAbsolute, resolve } from "node:path";
import { NextResponse } from "next/server";
import {
  filterAndSortGlobalSystems,
  globalWatchlistPageSize,
  globalWatchlistQuerySchema,
  type GlobalWatchlistFilterOption,
  type GlobalSystemIndexRow,
} from "@/lib/global-system-watchlist";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { humanizeBgsValue, tenantFactionAliases } from "@/lib/system-watchlist";
import { getTenantById } from "@/lib/tenant-config";

export const runtime = "nodejs";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

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
              : "GLOBAL_WATCHLIST_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "The global system watchlist is unavailable",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function rawSystemName(value: unknown): string {
  const item = record(value);
  const info = record(item.system_info);
  return String(
    item.requested_system ?? info.system_name ?? info.name ?? "",
  ).trim();
}

function configuredEddnDatabasePath(): string {
  const configured = process.env.VALK_EDDN_DATABASE?.trim();
  if (!configured) throw new Error("VALK_EDDN_DATABASE is not configured");
  const path = configured.startsWith("sqlite:///")
    ? decodeURIComponent(configured.slice("sqlite:///".length))
    : configured;
  return isAbsolute(path) ? path : resolve(path);
}

function filterOptions(
  rows: GlobalSystemIndexRow[],
  column: "allegiance" | "government",
): GlobalWatchlistFilterOption[] {
  return [...new Set(rows.map((row) => row[column]).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((value) => ({
      value,
      label: humanizeBgsValue(value) || value,
    }));
}

function loadTenantSystemIndex(
  database: Database.Database,
  factionName: string,
): GlobalSystemIndexRow[] {
  const aliases = tenantFactionAliases(factionName);
  if (!aliases.length) return [];
  const placeholders = aliases.map(() => "?").join(",");
  const names = (
    database
      .prepare(
        `SELECT DISTINCT system_name FROM eddn_faction WHERE name COLLATE NOCASE IN (${placeholders}) AND system_name IS NOT NULL`,
      )
      .all(...aliases) as {
      system_name: string;
    }[]
  ).map((row) => row.system_name);
  const metadata = new Map<string, GlobalSystemIndexRow>();
  for (let offset = 0; offset < names.length; offset += 500) {
    const chunk = names.slice(offset, offset + 500);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = database
      .prepare(
        `SELECT system_name, population, updated_at, controlling_faction, allegiance, government FROM eddn_system_info WHERE system_name IN (${placeholders})`,
      )
      .all(...chunk) as RecordValue[];
    for (const row of rows) {
      const systemName = String(row.system_name ?? "").trim();
      if (!systemName) continue;
      const population = Number(row.population);
      metadata.set(systemName.toLocaleLowerCase("en"), {
        system_name: systemName,
        population: Number.isFinite(population) ? population : null,
        updated_at: String(row.updated_at ?? ""),
        controlling_faction: String(row.controlling_faction ?? ""),
        allegiance: String(row.allegiance ?? ""),
        government: String(row.government ?? ""),
      });
    }
  }
  return names.map(
    (systemName) =>
      metadata.get(systemName.toLocaleLowerCase("en")) ?? {
        system_name: systemName,
        population: null,
        updated_at: "",
        controlling_faction: "",
        allegiance: "",
        government: "",
      },
  );
}

export async function GET(request: Request) {
  try {
    const parsed = globalWatchlistQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_GLOBAL_WATCHLIST_QUERY",
            message:
              parsed.error.issues[0]?.message ??
              "The global watchlist query is invalid",
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );

    const session = await requireDashboardSession();
    const tenant = await getTenantById(session.tenant.id);
    if (!tenant) throw new Error("The selected tenant is unavailable");

    const database = new Database(configuredEddnDatabasePath(), {
      readonly: true,
    });
    let total = 0;
    let systemNames: string[] = [];
    let allegiances: GlobalWatchlistFilterOption[] = [];
    let governments: GlobalWatchlistFilterOption[] = [];
    try {
      database.pragma("query_only = ON");
      database.pragma("busy_timeout = 5000");
      const index = loadTenantSystemIndex(database, tenant.factionName);
      const filtered = filterAndSortGlobalSystems(index, parsed.data);
      total = filtered.length;
      const pageStart = (parsed.data.page - 1) * globalWatchlistPageSize;
      systemNames = filtered
        .slice(pageStart, pageStart + globalWatchlistPageSize)
        .map((row) => row.system_name);
      allegiances = filterOptions(index, "allegiance");
      governments = filterOptions(index, "government");
    } finally {
      database.close();
    }

    let data: unknown[] = [];
    let generatedAt = new Date().toISOString();
    if (systemNames.length) {
      const upstreamUrl = new URL(request.url);
      upstreamUrl.search = "";
      const upstream = await flaskRequest(
        "system-watchlist-data",
        new Request(upstreamUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ systems: systemNames, history_days: 7 }),
        }),
        session,
      );
      const payload = record(await upstream.json().catch(() => null));
      if (!upstream.ok)
        return NextResponse.json(payload, {
          status: upstream.status,
          headers: { "cache-control": "no-store" },
        });
      generatedAt = String(payload.generated_at ?? generatedAt);
      const incomingData = Array.isArray(payload.data) ? payload.data : [];
      const dataByName = new Map(
        incomingData.map((item) => [rawSystemName(item).toLowerCase(), item]),
      );
      data = systemNames.map(
        (systemName) =>
          dataByName.get(systemName.toLowerCase()) ?? {
            requested_system: systemName,
            available: false,
            system_info: { system_name: systemName },
            factions: [],
            history: [],
            conflicts: [],
            powerplays: [],
          },
      );
    }

    return NextResponse.json(
      {
        data,
        generated_at: generatedAt,
        pagination: {
          page: parsed.data.page,
          page_size: globalWatchlistPageSize,
          total,
        },
        filter_options: { allegiances, governments },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

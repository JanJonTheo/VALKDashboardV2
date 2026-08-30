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
import { humanizeBgsValue } from "@/lib/system-watchlist";

export const runtime = "nodejs";

type RecordValue = Record<string, unknown>;

interface ProtectedFactionSummary {
  id: number;
  name: string;
  description: string;
  webhook_configured: boolean;
}

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
              : "PROTECTED_WATCHLIST_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "The protected-faction watchlist is unavailable",
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

function validDiscordWebhook(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? ""));
    return (
      url.protocol === "https:" &&
      [
        "discord.com",
        "ptb.discord.com",
        "canary.discord.com",
        "discordapp.com",
      ].includes(url.hostname.toLowerCase()) &&
      /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(
        url.pathname,
      ) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function protectedFaction(value: unknown): ProtectedFactionSummary | null {
  const item = record(value);
  const id = Number(item.id);
  const name = String(item.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !name || item.protected !== true)
    return null;
  return {
    id,
    name,
    description: String(item.description ?? "").trim(),
    webhook_configured: validDiscordWebhook(item.webhook_url),
  };
}

async function loadProtectedFactions(
  request: Request,
  session: Awaited<ReturnType<typeof requireDashboardSession>>,
): Promise<ProtectedFactionSummary[]> {
  const upstreamUrl = new URL(request.url);
  upstreamUrl.search = "";
  const response = await flaskRequest(
    "protected-faction",
    new Request(upstreamUrl, { method: "GET" }),
    session,
  );
  const payload = record(await response.json().catch(() => null));
  if (!response.ok)
    throw new Error(
      String(
        record(payload.error).message ??
          payload.error ??
          "Protected factions could not be loaded",
      ),
    );
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const unique = new Map<string, ProtectedFactionSummary>();
  for (const value of rows) {
    const faction = protectedFaction(value);
    if (faction) unique.set(faction.name.toLocaleLowerCase("en"), faction);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }) ||
      left.id - right.id,
  );
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

function loadFactionSystemIndex(
  database: Database.Database,
  factionNames: string[],
): GlobalSystemIndexRow[] {
  if (!factionNames.length) return [];
  const placeholders = factionNames.map(() => "?").join(",");
  const incomingNames = (
    database
      .prepare(
        `SELECT DISTINCT system_name FROM eddn_faction WHERE name COLLATE NOCASE IN (${placeholders}) AND system_name IS NOT NULL ORDER BY system_name COLLATE NOCASE`,
      )
      .all(...factionNames) as { system_name: string }[]
  ).map((row) => row.system_name);
  const names = [
    ...new Map(
      incomingNames.map((name) => [name.toLocaleLowerCase("en"), name]),
    ).values(),
  ];
  const metadata = new Map<string, GlobalSystemIndexRow>();
  for (let offset = 0; offset < names.length; offset += 500) {
    const chunk = names.slice(offset, offset + 500);
    const chunkPlaceholders = chunk.map(() => "?").join(",");
    const rows = database
      .prepare(
        `SELECT system_name, population, updated_at, controlling_faction, allegiance, government FROM eddn_system_info WHERE system_name COLLATE NOCASE IN (${chunkPlaceholders})`,
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
    const url = new URL(request.url);
    const queryValues = Object.fromEntries(url.searchParams);
    delete queryValues.protected_faction_id;
    const parsed = globalWatchlistQuerySchema.safeParse(queryValues);
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PROTECTED_WATCHLIST_QUERY",
            message:
              parsed.error.issues[0]?.message ??
              "The protected-faction watchlist query is invalid",
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );

    const rawFactionId = url.searchParams.get("protected_faction_id");
    const selectedFactionId = rawFactionId ? Number(rawFactionId) : null;
    if (
      selectedFactionId !== null &&
      (!Number.isInteger(selectedFactionId) || selectedFactionId <= 0)
    )
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PROTECTED_FACTION",
            message: "Select a valid protected faction",
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );

    const session = await requireDashboardSession();
    const protectedFactions = await loadProtectedFactions(request, session);
    const selectedFaction =
      selectedFactionId === null
        ? null
        : protectedFactions.find((faction) => faction.id === selectedFactionId);
    if (selectedFactionId !== null && !selectedFaction)
      return NextResponse.json(
        {
          error: {
            code: "PROTECTED_FACTION_NOT_FOUND",
            message: "The selected protected faction is no longer active",
          },
        },
        { status: 404, headers: { "cache-control": "no-store" } },
      );

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
      const index = loadFactionSystemIndex(
        database,
        selectedFaction
          ? [selectedFaction.name]
          : protectedFactions.map((faction) => faction.name),
      );
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
        protected_factions: protectedFactions,
        selected_protected_faction_id: selectedFactionId,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownUp,
  BellRing,
  Bot,
  Building2,
  Check,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Construction,
  ExternalLink,
  Factory,
  Flag,
  Flame,
  FlaskConical,
  History,
  Leaf,
  ListFilter,
  Map as MapIcon,
  Minus,
  Orbit,
  PartyPopper,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Skull,
  Star,
  Sun,
  Swords,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  WheatOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SetStateAction,
} from "react";
import {
  assignFactionColours,
  calculateWatchlistStatistics,
  emptyWatchlistFilters,
  hasTenantFaction,
  matchesWatchlistFilters,
  normalizeWatchedSystems,
  sortWatchlistEntries,
  systemWatchlistEntrySchema,
  watchlistSortOptions,
  type SystemWatchlistEntry,
  type WatchlistDistributionItem,
  type WatchlistFacilityStatistics,
  type WatchlistStatistics,
  type WatchlistSortField,
  type WatchlistFilters,
  type WatchedFaction,
  type WatchedSystem,
} from "@/lib/system-watchlist";
import {
  globalWatchlistPageSize,
  globalWatchlistSortOptions,
  type GlobalWatchlistFilterOption,
  type GlobalWatchlistSortField,
} from "@/lib/global-system-watchlist";
import { CopyTextButton } from "@/components/copy-text-button";
import { BgsAiPanel } from "@/components/bgs-ai-panel";
import { BgsRuleManager } from "@/components/bgs-rule-manager";
import { PageViewRegistration } from "@/components/page-view-context";
import { SavedViewsControl } from "@/components/saved-views-control";
import { viewFilterString, type ViewPreference } from "@/lib/preferences";
import { useStoredViewPreference } from "@/lib/use-view-preference";
import { bgsStatePresentation, type BgsStateIcon } from "@/lib/bgs-state";
import {
  stationCategory,
  stationCategoryTabs,
  stationIconKind,
  stationMatchesCategory,
  type StationIconKind,
  type StationCategory,
} from "@/lib/system-stations";

interface WatchlistPayload {
  watchlist: SystemWatchlistEntry[];
  systems: WatchedSystem[];
  facilityStatistics: WatchlistFacilityStatistics;
  generatedAt: string;
}

type WatchlistScope = "personal" | "global" | "protected";

interface GlobalWatchlistPayload {
  systems: WatchedSystem[];
  generatedAt: string;
  pagination: { page: number; pageSize: number; total: number };
  filterOptions: {
    allegiances: GlobalWatchlistFilterOption[];
    governments: GlobalWatchlistFilterOption[];
  };
}

interface ProtectedFactionSummary {
  id: number;
  name: string;
  description: string;
  webhook_configured: boolean;
}

interface ProtectedWatchlistPayload extends GlobalWatchlistPayload {
  protectedFactions: ProtectedFactionSummary[];
  selectedProtectedFactionId: number | null;
}

const superpowerIconSources: Record<string, string> = {
  alliance: "/superpowers/alliance.svg",
  empire: "/superpowers/empire.svg",
  federation: "/superpowers/federation.svg",
  independent: "/superpowers/independent.webp",
};

function superpowerIconSource(allegiance: string) {
  const normalized = allegiance
    .trim()
    .toLocaleLowerCase("en")
    .replace(/^\$/, "")
    .replace(/;$/, "");
  const key = normalized.split(/[_\s]+/).at(-1) ?? "";
  return superpowerIconSources[key];
}

function filterOptionValues(
  systems: WatchedSystem[],
  field: "allegiance" | "government",
): GlobalWatchlistFilterOption[] {
  return [...new Set(systems.map((system) => system[field]).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((value) => ({ value, label: value }));
}

function activeFilterCount(filters: WatchlistFilters, scope: WatchlistScope) {
  return Object.entries(filters).filter(
    ([key, value]) =>
      Boolean(value) && (scope === "personal" || key !== "sector"),
  ).length;
}

type WatchlistViewChange = {
  filters?: WatchlistFilters;
  sortField?: WatchlistSortField | GlobalWatchlistSortField;
  sortDescending?: boolean;
  protectedFactionId?: number | null;
};

interface WatchlistViewProps {
  viewFilters: WatchlistFilters;
  viewSortField: string;
  viewSortDescending: boolean;
  viewProtectedFactionId: number | null;
  onViewChange: (change: WatchlistViewChange) => void;
}

interface SystemStation {
  id: string;
  market_id: string;
  name: string;
  carrier_name: string;
  carrier_owner: string;
  type: string;
  is_settlement: boolean;
  distance_to_arrival: number | null;
  body: string;
  latitude: number | null;
  longitude: number | null;
  controlling_faction: string;
  allegiance: string;
  government: string;
  economy: string;
  second_economy: string;
  services: string[];
  have_market: boolean;
  have_shipyard: boolean;
  have_outfitting: boolean;
  updated_at: string;
}

interface StationPayload {
  system: string;
  source: string;
  source_url: string;
  cached_at?: string;
  cache_status?: "HIT" | "MISS" | "STALE";
  stale?: boolean;
  stations: SystemStation[];
}

const stationIconSources: Partial<Record<StationIconKind, string>> = {
  coriolis: "/station-icons/coriolis.svg",
  dodec: "/station-icons/dodec.svg",
  orbis: "/station-icons/orbis.svg",
  ocellus: "/station-icons/ocellus.svg",
  "asteroid-base": "/station-icons/asteroid-base.svg",
  outpost: "/station-icons/outpost.svg",
  "surface-port": "/station-icons/surface-port.svg",
  "surface-outpost": "/station-icons/surface-port.svg",
  settlement: "/station-icons/settlement.svg",
};

function StationGameIcon({ kind }: { kind: StationIconKind }) {
  const source = stationIconSources[kind];
  if (source)
    return (
      <Image
        className="watch-station-game-icon"
        data-kind={kind}
        src={source}
        width={24}
        height={24}
        alt=""
        aria-hidden="true"
        unoptimized
      />
    );
  const content = (() => {
    switch (kind) {
      case "installation-space":
        return (
          <>
            <path d="m12 7 5 3v5l-5 3-5-3v-5l5-3Z" />
            <path d="M2 12h5M17 12h5M12 2v5M12 18v4" />
            <circle cx="3" cy="12" r="1" />
            <circle cx="21" cy="12" r="1" />
          </>
        );
      case "installation-planetary":
        return (
          <>
            <path d="M2 21h20M4 21V9h5v12M9 13l5-3v11M14 14l6-3v10" />
            <path d="M5.5 5h2v4M6 15h1M11 16h1M16 16h2" />
          </>
        );
      case "fleet-carrier":
        return (
          <>
            <path d="M2 15h17l3 3H6l-4-3ZM6 15V9h10l3 6M9 9V6h5l2 3" />
            <path d="M4 19h15" />
          </>
        );
      default:
        return (
          <>
            <path d="m12 3 8 9-8 9-8-9 8-9Z" />
            <circle cx="12" cy="12" r="2" />
          </>
        );
    }
  })();
  return (
    <svg
      className="watch-station-game-icon"
      data-kind={kind}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

async function loadWatchlist(): Promise<WatchlistPayload> {
  const response = await fetch("/api/system-watchlist/data", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok)
    throw new Error(
      ((payload?.error as { message?: string } | undefined)?.message as
        string | undefined) ?? "The BGS watchlist is unavailable",
    );
  const facilityStatistics = (payload?.facility_statistics ?? {}) as Record<
    string,
    unknown
  >;
  const facilityTypes = (facilityStatistics.types ?? {}) as Record<
    string,
    unknown
  >;
  return {
    watchlist: Array.isArray(payload?.watchlist)
      ? (payload.watchlist as SystemWatchlistEntry[])
      : [],
    systems: normalizeWatchedSystems(payload),
    facilityStatistics: {
      dodec: Number(facilityTypes.dodec) || 0,
      orbis: Number(facilityTypes.orbis) || 0,
      ocellus: Number(facilityTypes.ocellus) || 0,
      coriolis: Number(facilityTypes.coriolis) || 0,
      cachedSystems: Number(facilityStatistics.cached_systems) || 0,
      requestedSystems: Number(facilityStatistics.requested_systems) || 0,
    },
    generatedAt: String(payload?.generated_at ?? new Date().toISOString()),
  };
}

async function saveWatchlist(systems: SystemWatchlistEntry[]) {
  const response = await fetch("/api/system-watchlist", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ systems }),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? "The watchlist could not be saved",
    );
}

async function loadGlobalWatchlist(
  page: number,
  sortField: GlobalWatchlistSortField,
  sortDescending: boolean,
  filters: WatchlistFilters,
): Promise<GlobalWatchlistPayload> {
  const parameters = new URLSearchParams({
    page: String(page),
    sort: sortField,
    direction: sortDescending ? "desc" : "asc",
  });
  const optionalParameters: Record<string, string> = {
    system: filters.system,
    controlling_faction: filters.controllingFaction,
    population_min: filters.populationMin,
    population_max: filters.populationMax,
    updated_from: filters.updatedFrom,
    updated_to: filters.updatedTo,
    allegiance: filters.allegiance,
    government: filters.government,
  };
  Object.entries(optionalParameters).forEach(([key, value]) => {
    if (value) parameters.set(key, value);
  });
  const response = await fetch(`/api/system-watchlist/global?${parameters}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok)
    throw new Error(
      ((payload?.error as { message?: string } | undefined)?.message as
        string | undefined) ?? "The global BGS watchlist is unavailable",
    );
  const pagination = (payload?.pagination ?? {}) as Record<string, unknown>;
  const filterOptions = (payload?.filter_options ?? {}) as Record<
    string,
    unknown
  >;
  return {
    systems: normalizeWatchedSystems(payload),
    generatedAt: String(payload?.generated_at ?? new Date().toISOString()),
    pagination: {
      page: Number(pagination.page) || page,
      pageSize: Number(pagination.page_size) || globalWatchlistPageSize,
      total: Number(pagination.total) || 0,
    },
    filterOptions: {
      allegiances: Array.isArray(filterOptions.allegiances)
        ? (filterOptions.allegiances as GlobalWatchlistFilterOption[])
        : [],
      governments: Array.isArray(filterOptions.governments)
        ? (filterOptions.governments as GlobalWatchlistFilterOption[])
        : [],
    },
  };
}

async function loadProtectedWatchlist(
  page: number,
  sortField: GlobalWatchlistSortField,
  sortDescending: boolean,
  filters: WatchlistFilters,
  protectedFactionId: number | null,
): Promise<ProtectedWatchlistPayload> {
  const parameters = new URLSearchParams({
    page: String(page),
    sort: sortField,
    direction: sortDescending ? "desc" : "asc",
  });
  if (protectedFactionId !== null)
    parameters.set("protected_faction_id", String(protectedFactionId));
  const optionalParameters: Record<string, string> = {
    system: filters.system,
    controlling_faction: filters.controllingFaction,
    population_min: filters.populationMin,
    population_max: filters.populationMax,
    updated_from: filters.updatedFrom,
    updated_to: filters.updatedTo,
    allegiance: filters.allegiance,
    government: filters.government,
  };
  Object.entries(optionalParameters).forEach(([key, value]) => {
    if (value) parameters.set(key, value);
  });
  const response = await fetch(
    `/api/system-watchlist/protected?${parameters}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!response.ok)
    throw new Error(
      ((payload?.error as { message?: string } | undefined)?.message as
        string | undefined) ?? "The protected-faction watchlist is unavailable",
    );
  const pagination = (payload?.pagination ?? {}) as Record<string, unknown>;
  const filterOptions = (payload?.filter_options ?? {}) as Record<
    string,
    unknown
  >;
  return {
    systems: normalizeWatchedSystems(payload),
    generatedAt: String(payload?.generated_at ?? new Date().toISOString()),
    pagination: {
      page: Number(pagination.page) || page,
      pageSize: Number(pagination.page_size) || globalWatchlistPageSize,
      total: Number(pagination.total) || 0,
    },
    filterOptions: {
      allegiances: Array.isArray(filterOptions.allegiances)
        ? (filterOptions.allegiances as GlobalWatchlistFilterOption[])
        : [],
      governments: Array.isArray(filterOptions.governments)
        ? (filterOptions.governments as GlobalWatchlistFilterOption[])
        : [],
    },
    protectedFactions: Array.isArray(payload?.protected_factions)
      ? (payload.protected_factions as ProtectedFactionSummary[])
      : [],
    selectedProtectedFactionId:
      payload?.selected_protected_faction_id === null ||
      payload?.selected_protected_faction_id === undefined
        ? null
        : Number(payload.selected_protected_faction_id),
  };
}

async function loadStations(system: string): Promise<StationPayload> {
  const parameters = new URLSearchParams({ system });
  const response = await fetch(`/api/system-watchlist/stations?${parameters}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as {
    data?: StationPayload;
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? "Station and settlement data is unavailable",
    );
  return (
    payload?.data ?? {
      system,
      source: "Spansh",
      source_url: "",
      stations: [],
    }
  );
}

type FactionFillStyle = CSSProperties & {
  "--faction-colour": string;
  "--faction-fill": string;
  "--superpower-icon"?: string;
};

export function factionFillStyle(
  faction: Pick<WatchedFaction, "influence" | "allegiance">,
  colour: string,
): FactionFillStyle {
  const influence = Math.min(100, Math.max(0, faction.influence));
  const icon = superpowerIconSource(faction.allegiance);
  return {
    borderLeftColor: colour,
    "--faction-colour": colour,
    "--faction-fill": `${influence}%`,
    ...(icon ? { "--superpower-icon": `url("${icon}")` } : {}),
  };
}

function formatPopulation(value: number) {
  return new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value);
}

function formatUpdated(value: string) {
  if (!value) return "No update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function BgsChip({
  icon: Icon,
  label,
  value,
  kind,
  status,
  showLabel = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  kind: "government" | "allegiance" | "status" | "economy" | "neutral";
  status?: "active" | "pending";
  showLabel?: boolean;
}) {
  if (!value) return null;
  return (
    <span
      className="bgs-chip"
      data-kind={kind}
      data-status={status}
      title={`${label}: ${value}`}
    >
      <Icon size={10} aria-hidden="true" />
      {showLabel && <small>{label}</small>}
      <span className="bgs-chip-value">{value}</span>
    </span>
  );
}

function InfluenceHistoryChart({ factions }: { factions: WatchedFaction[] }) {
  const histories = factions.filter((faction) => faction.history.length > 0);
  const colours = assignFactionColours(factions);
  if (!histories.length)
    return (
      <div className="watch-history-detail-empty">
        Influence history starts with the next available EDDN snapshots.
      </div>
    );

  const option = {
    animationDuration: 300,
    aria: {
      enabled: true,
      description:
        "Minor faction influence from settled BGS snapshots over the last seven days.",
    },
    color: histories.map((faction) => colours.get(faction.name) ?? "#e8bd52"),
    textStyle: { fontFamily: "Arial, sans-serif", color: "#aab4c1" },
    legend: {
      type: "scroll",
      top: 4,
      left: 4,
      right: 4,
      icon: "roundRect",
      itemWidth: 16,
      itemHeight: 4,
      itemGap: 14,
      textStyle: { color: "#d2d8e0", fontSize: 11 },
      pageIconColor: "#e8bd52",
      pageIconInactiveColor: "#46515f",
      pageTextStyle: { color: "#aab4c1", fontSize: 10 },
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "#121821",
      borderColor: "#303946",
      padding: 12,
      textStyle: { color: "#f2f4f7", fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: "#667383" } },
      formatter: (parameters: unknown) => {
        const items = (
          Array.isArray(parameters) ? parameters : [parameters]
        ) as {
          axisValue?: string | number;
          marker?: string;
          seriesName?: string;
          value?: [string | number, number] | number;
        }[];
        const timestamp = items[0]?.axisValue;
        const date = timestamp ? new Date(timestamp) : null;
        const heading =
          date && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
                timeZoneName: "short",
              }).format(date)
            : String(timestamp ?? "Snapshot");
        const lines = items
          .map((item) => {
            const value = Array.isArray(item.value)
              ? Number(item.value[1])
              : Number(item.value);
            return `<div class="watch-history-tooltip-row"><span>${item.marker ?? ""}${escapeHtml(String(item.seriesName ?? "Faction"))}</span><b>${Number.isFinite(value) ? value.toFixed(2) : "—"}%</b></div>`;
          })
          .join("");
        return `<div class="watch-history-tooltip"><strong>${escapeHtml(heading)}</strong>${lines}</div>`;
      },
    },
    grid: { left: 45, right: 96, top: 58, bottom: 40 },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: "#33404c" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#778291",
        fontSize: 10,
        hideOverlap: true,
        formatter: (value: number) =>
          new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(value)),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      name: "INFLUENCE %",
      nameLocation: "end",
      nameGap: 12,
      nameTextStyle: { color: "#8793a1", fontSize: 10 },
      axisLabel: {
        color: "#778291",
        fontSize: 10,
        formatter: "{value}%",
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#252e38", type: "dashed" } },
    },
    series: histories.map((faction) => {
      const colour = colours.get(faction.name) ?? "#e8bd52";
      return {
        name: faction.name,
        type: "line",
        data: faction.history.map((point) => [
          point.timestamp,
          point.influence,
        ]),
        showSymbol: true,
        symbol: "circle",
        symbolSize: 7,
        connectNulls: false,
        lineStyle: { width: 2, color: colour },
        itemStyle: {
          color: colour,
          borderColor: "#0d1218",
          borderWidth: 1.5,
        },
        emphasis: {
          focus: "series",
          lineStyle: { width: 3 },
          itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        },
        endLabel: {
          show: true,
          color: colour,
          fontSize: 11,
          fontWeight: 700,
          backgroundColor: "#0d1218e8",
          borderColor: colour,
          borderWidth: 1,
          borderRadius: 3,
          padding: [3, 5],
          formatter: (parameters: unknown) => {
            const item = parameters as {
              value?: [string | number, number] | number;
            };
            const value = Array.isArray(item.value)
              ? Number(item.value[1])
              : Number(item.value);
            return Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
          },
        },
        labelLayout: { moveOverlap: "shiftY" },
      };
    }),
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 340, width: "100%" }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
    />
  );
}

function DistributionBars({
  items,
  total,
}: {
  items: WatchlistDistributionItem[];
  total: number;
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="watch-statistics-distribution">
      {items.map((item) => (
        <div key={item.label}>
          <span title={item.label}>{item.label}</span>
          <i aria-hidden="true">
            <b style={{ width: `${(item.count / maximum) * 100}%` }} />
          </i>
          <strong>
            {item.count}
            <small>
              {total ? `${Math.round((item.count / total) * 100)}%` : "0%"}
            </small>
          </strong>
        </div>
      ))}
    </div>
  );
}

function WatchlistStatisticsDialog({
  statistics,
  open,
  onOpenChange,
}: {
  statistics: WatchlistStatistics;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content watch-statistics-dialog">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Watchlist statistics</Dialog.Title>
              <Dialog.Description>
                Aggregated current EDDN data and locally cached Spansh station
                data for your personal system list.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close statistics">
              <X size={19} />
            </Dialog.Close>
          </div>
          <div className="watch-statistics-kpis">
            <article>
              <Orbit size={18} aria-hidden="true" />
              <span>Systems</span>
              <strong>{statistics.systemCount}</strong>
              <small>{statistics.availableCount} with current EDDN data</small>
            </article>
            <article>
              <Users size={18} aria-hidden="true" />
              <span>Total population</span>
              <strong>
                {new Intl.NumberFormat("en-GB").format(
                  statistics.totalPopulation,
                )}
              </strong>
              <small>Available systems combined</small>
            </article>
            <article>
              <Building2 size={18} aria-hidden="true" />
              <span>Largest population</span>
              <strong>
                {statistics.largestPopulationSystem?.name ?? "No data"}
              </strong>
              <small>
                {statistics.largestPopulationSystem
                  ? new Intl.NumberFormat("en-GB").format(
                      statistics.largestPopulationSystem.population,
                    )
                  : "—"}
              </small>
            </article>
          </div>
          <div className="watch-statistics-sections">
            <section>
              <header>
                <Shield size={16} aria-hidden="true" />
                <h3>Security level</h3>
              </header>
              <DistributionBars
                items={statistics.security}
                total={statistics.availableCount}
              />
            </section>
            <section>
              <header>
                <Flag size={16} aria-hidden="true" />
                <h3>Allegiance</h3>
              </header>
              <DistributionBars
                items={statistics.allegiance}
                total={statistics.availableCount}
              />
            </section>
            <section>
              <header>
                <Zap size={16} aria-hidden="true" />
                <h3>Powerplay faction</h3>
              </header>
              <DistributionBars
                items={statistics.powerplay}
                total={statistics.availableCount}
              />
            </section>
            <section>
              <header>
                <Building2 size={16} aria-hidden="true" />
                <h3>Station types</h3>
              </header>
              <DistributionBars
                items={statistics.facilities}
                total={statistics.facilities.reduce(
                  (sum, item) => sum + item.count,
                  0,
                )}
              />
              <small className="watch-statistics-source-note">
                Cached data for {statistics.facilityCachedSystems} monitored
                systems
              </small>
            </section>
          </div>
          {statistics.availableCount < statistics.systemCount && (
            <p className="watch-statistics-note">
              Population and distributions exclude the{" "}
              {statistics.systemCount - statistics.availableCount} system(s)
              without current EDDN data.
            </p>
          )}
          <footer>
            <Dialog.Close className="primary-button">Done</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StationList({
  stations,
  source,
  sourceUrl,
  cacheStatus,
  stale,
}: {
  stations: SystemStation[];
  source: string;
  sourceUrl: string;
  cacheStatus?: StationPayload["cache_status"];
  stale?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<StationCategory>("all");
  const stationCount = stations.filter(
    (station) => !station.is_settlement,
  ).length;
  const settlementCount = stations.length - stationCount;
  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        stationCategoryTabs.map(({ value }) => [
          value,
          value === "all"
            ? stations.length
            : stations.filter((station) =>
                stationMatchesCategory(station, value),
              ).length,
        ]),
      ) as Record<StationCategory, number>,
    [stations],
  );
  const visibleStations = useMemo(
    () =>
      stations.filter((station) =>
        stationMatchesCategory(station, activeCategory),
      ),
    [activeCategory, stations],
  );
  return (
    <section className="watch-stations-section">
      <header>
        <div>
          <span>Stations &amp; settlements</span>
          <small>
            {stationCount} stations · {settlementCount} settlements · Local
            cache{cacheStatus ? ` ${cacheStatus}` : ""}
            {stale ? " · serving last known data" : ""}
          </small>
        </div>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Source: {source} <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : (
          <b>Source: {source}</b>
        )}
      </header>
      {stations.length ? (
        <>
          <div
            className="watch-station-tabs"
            role="tablist"
            aria-label="Filter stations and settlements"
          >
            {stationCategoryTabs.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeCategory === value}
                onClick={() => setActiveCategory(value)}
              >
                {label} <span>{categoryCounts[value]}</span>
              </button>
            ))}
          </div>
          {visibleStations.length ? (
            <div className="watch-station-list" role="tabpanel">
              {visibleStations.map((station) => {
                const category = stationCategory(station);
                const isCarrier = category === "fleet-carriers";
                const iconKind = stationIconKind(station);
                const displayName =
                  isCarrier &&
                  station.carrier_name &&
                  station.carrier_name !== station.name
                    ? `${station.carrier_name} (${station.name})`
                    : station.name;
                return (
                  <article
                    key={station.id || `${station.name}-${station.type}`}
                  >
                    <div className="watch-station-title">
                      <StationGameIcon kind={iconKind} />
                      <div>
                        <strong title={displayName}>{displayName}</strong>
                        <span>{station.type}</span>
                      </div>
                      {station.distance_to_arrival !== null && (
                        <b>
                          {new Intl.NumberFormat("en-GB", {
                            maximumFractionDigits: 0,
                          }).format(station.distance_to_arrival)}{" "}
                          ls
                        </b>
                      )}
                    </div>
                    <dl>
                      <div>
                        <dt>{isCarrier ? "Owner" : "Faction"}</dt>
                        <dd>
                          {isCarrier
                            ? station.carrier_owner || "Not published by Spansh"
                            : station.controlling_faction || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Body</dt>
                        <dd>{station.body || "Space"}</dd>
                      </div>
                      <div>
                        <dt>Economy</dt>
                        <dd>
                          {[station.economy, station.second_economy]
                            .filter(Boolean)
                            .join(" / ") || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatUpdated(station.updated_at)}</dd>
                      </div>
                    </dl>
                    <div
                      className="watch-station-services"
                      aria-label="Services"
                    >
                      {station.have_market && <span>Market</span>}
                      {station.have_shipyard && <span>Shipyard</span>}
                      {station.have_outfitting && <span>Outfitting</span>}
                      {station.services.slice(0, 4).map((service) => (
                        <span key={service}>{service}</span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-empty watch-station-empty">
              No facilities in this category.
            </p>
          )}
        </>
      ) : (
        <p className="inline-empty">No stations or settlements reported.</p>
      )}
    </section>
  );
}

function edgisPageUrl(system: string) {
  return `https://elitedangereuse.fr/outils/sysmap.php?system=${encodeURIComponent(system)}`;
}

function EdgisSystemMapDialog({
  system,
  open,
  onOpenChange,
}: {
  system: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {open && <EdgisSystemMapContent system={system} />}
    </Dialog.Root>
  );
}

function EdgisSystemMapContent({ system }: { system: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const mapUrl = `/api/system-watchlist/sysmap?${new URLSearchParams({ system })}`;

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="modal-content edgis-map-dialog">
        <div className="sheet-heading">
          <div>
            <Dialog.Title>EDGIS system map</Dialog.Title>
            <Dialog.Description>{system}</Dialog.Description>
          </div>
          <Dialog.Close aria-label="Close EDGIS system map">
            <X size={19} />
          </Dialog.Close>
        </div>
        <div className="edgis-map-stage" aria-busy={loading}>
          {!failed && (
            <Image
              src={mapUrl}
              alt={`EDGIS system map for ${system}`}
              width={1440}
              height={900}
              unoptimized
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
          )}
          {loading && !failed && (
            <div className="edgis-map-message">
              <RefreshCw className="spin" size={20} aria-hidden="true" />
              <span>Rendering the EDGIS system map…</span>
            </div>
          )}
          {failed && (
            <div className="edgis-map-message error" role="alert">
              <AlertTriangle size={20} aria-hidden="true" />
              <span>The EDGIS system map could not be rendered.</span>
            </div>
          )}
        </div>
        <footer>
          <a
            className="secondary-button"
            href={edgisPageUrl(system)}
            target="_blank"
            rel="noreferrer"
          >
            Open on EDGIS <ExternalLink size={13} aria-hidden="true" />
          </a>
          <Dialog.Close className="primary-button">Done</Dialog.Close>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

const bgsStateIcons: Record<BgsStateIcon, LucideIcon> = {
  swords: Swords,
  vote: Vote,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  flame: Flame,
  "wheat-off": WheatOff,
  flask: FlaskConical,
  coins: CircleDollarSign,
  party: PartyPopper,
  construction: Construction,
  sun: Sun,
  leaf: Leaf,
  skull: Skull,
  "arrow-down": ArrowDown,
  minus: Minus,
};

function BgsStateCell({ states }: { states: string[] }) {
  const values = states.length ? states : [""];
  return (
    <div className="watch-state-list">
      {values.map((state, index) => {
        const presentation = bgsStatePresentation(state);
        const Icon = bgsStateIcons[presentation.icon];
        return (
          <span
            className="watch-state-chip"
            key={`${presentation.key}-${index}`}
            style={
              {
                "--state-colour": presentation.colour,
              } as CSSProperties
            }
          >
            <Icon size={11} aria-hidden="true" />
            {presentation.label}
          </span>
        );
      })}
    </div>
  );
}

function BgsAiDialog({
  system,
  open,
  onOpenChange,
  canRun,
}: {
  system: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRun: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content bgs-ai-dialog">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>BGS AI intelligence</Dialog.Title>
              <Dialog.Description>{system}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close BGS AI intelligence">
              <X size={19} />
            </Dialog.Close>
          </div>
          <BgsAiPanel system={system} canRun={canRun} />
          <footer>
            <Dialog.Close className="primary-button">Done</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SystemRecordDetail({
  system,
  open,
  onOpenChange,
  canRunBgsAi,
}: {
  system: WatchedSystem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRunBgsAi: boolean;
}) {
  const colours = assignFactionColours(system.factions);
  const [mapOpen, setMapOpen] = useState(false);
  const conflictTypes = useMemo(
    () => [
      ...new Set(
        system.conflicts.map(
          (conflict) => bgsStatePresentation(conflict.type || "Conflict").label,
        ),
      ),
    ],
    [system.conflicts],
  );
  const stationQuery = useQuery({
    queryKey: ["system-stations", system.name],
    queryFn: () => loadStations(system.name),
    enabled: open,
    staleTime: 15 * 60_000,
    retry: 1,
  });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content system-detail-sheet watch-history-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Record detail</Dialog.Title>
              <Dialog.Description>
                Current system, facility and settled seven-day BGS data.
              </Dialog.Description>
            </div>
            <div className="sheet-heading-actions">
              {system.conflicts.length > 0 && (
                <span
                  className="watch-detail-conflict-chip"
                  title={`${system.conflicts.length} current conflict${system.conflicts.length === 1 ? "" : "s"}`}
                >
                  <Swords size={13} aria-hidden="true" />
                  {conflictTypes.join(" · ")}
                </span>
              )}
              <Dialog.Close aria-label="Close details">
                <X size={19} />
              </Dialog.Close>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>System</dt>
              <dd className="copyable-value">
                <span>{system.name}</span>
                <CopyTextButton value={system.name} label="Copy system name" />
              </dd>
            </div>
            <div>
              <dt>Population</dt>
              <dd>
                {new Intl.NumberFormat("en-GB").format(system.population)}
              </dd>
            </div>
            <div>
              <dt>Controlling faction</dt>
              <dd>{system.controllingFaction || "—"}</dd>
            </div>
            <div>
              <dt>Allegiance</dt>
              <dd>{system.allegiance || "—"}</dd>
            </div>
            <div>
              <dt>Government</dt>
              <dd>{system.government || "—"}</dd>
            </div>
            <div>
              <dt>Economy</dt>
              <dd>{system.economy || "—"}</dd>
            </div>
            <div>
              <dt>Security</dt>
              <dd>{system.security || "—"}</dd>
            </div>
            <div>
              <dt>Powerplay</dt>
              <dd>{system.powerplayPowers.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Info updated</dt>
              <dd>{formatUpdated(system.updatedAt)} UTC</dd>
            </div>
          </dl>
          <section className="watch-edgis-entry">
            <MapIcon size={20} aria-hidden="true" />
            <div>
              <strong>EDGIS system map</strong>
              <span>Interactive source with a cached dashboard preview.</span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setMapOpen(true)}
            >
              Show map
            </button>
            <a
              href={edgisPageUrl(system.name)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${system.name} on EDGIS`}
              title="Open on EDGIS"
            >
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </section>
          {stationQuery.data ? (
            <StationList
              stations={stationQuery.data.stations}
              source={stationQuery.data.source}
              sourceUrl={stationQuery.data.source_url}
              cacheStatus={stationQuery.data.cache_status}
              stale={stationQuery.data.stale}
            />
          ) : stationQuery.isError ? (
            <section className="watch-stations-section error" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <div>
                <strong>
                  Stations and settlements are temporarily unavailable
                </strong>
                <span>{stationQuery.error.message}</span>
              </div>
              <button
                className="secondary-button"
                onClick={() => stationQuery.refetch()}
              >
                Retry
              </button>
            </section>
          ) : (
            <section
              className="watch-stations-section loading"
              aria-busy="true"
            >
              <RefreshCw className="spin" size={17} aria-hidden="true" />
              <div>
                <strong>Stations &amp; settlements</strong>
                <span>
                  Loading from the local Spansh cache. The first lookup for a
                  system can take a few seconds…
                </span>
              </div>
            </section>
          )}
          <section className="watch-history-factions">
            <h3>Minor factions</h3>
            <div className="watch-faction-table-wrap">
              <table className="watch-faction-table">
                <thead>
                  <tr>
                    <th>Faction</th>
                    <th>Active state</th>
                    <th>Pending state</th>
                    <th>Influence</th>
                  </tr>
                </thead>
                <tbody>
                  {system.factions.map((faction) => {
                    const colour = colours.get(faction.name) ?? "#e8bd52";
                    return (
                      <tr
                        className="watch-history-faction-row"
                        key={faction.name}
                        style={factionFillStyle(faction, colour)}
                        aria-label={`${faction.name}, influence ${faction.influence.toFixed(2)} percent`}
                      >
                        <td>
                          <strong>
                            <i style={{ backgroundColor: colour }} />
                            {faction.name}
                          </strong>
                        </td>
                        <td>
                          <BgsStateCell states={faction.activeStates} />
                        </td>
                        <td>
                          <BgsStateCell states={faction.pendingStates} />
                        </td>
                        <td>
                          <b>{faction.influence.toFixed(2)}%</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {system.conflicts.length > 0 && (
            <section className="watch-conflict-detail">
              <header>
                <Swords size={15} aria-hidden="true" />
                <h3>Current conflicts</h3>
              </header>
              <div>
                {system.conflicts.map((conflict, index) => (
                  <article
                    key={`${conflict.faction1}-${conflict.faction2}-${index}`}
                  >
                    <strong>
                      {conflict.faction1 || "Unknown faction"} vs.{" "}
                      {conflict.faction2 || "Unknown faction"}
                    </strong>
                    <span>
                      {[conflict.type, conflict.status]
                        .filter(Boolean)
                        .join(" · ") || "Conflict"}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="watch-history-detail">
            <header>
              <div>
                <span>Influence history</span>
                <small>Settled BGS snapshots plus the latest EDDN value</small>
              </div>
              <b>
                <History size={12} aria-hidden="true" /> Last 7 days
              </b>
            </header>
            <InfluenceHistoryChart factions={system.factions} />
          </section>
          <BgsAiPanel system={system.name} canRun={canRunBgsAi} />
          <footer>
            <Dialog.Close className="primary-button">Done</Dialog.Close>
          </footer>
          <EdgisSystemMapDialog
            system={system.name}
            open={mapOpen}
            onOpenChange={setMapOpen}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FactionRail({
  factions,
  active,
  onActive,
}: {
  factions: WatchedFaction[];
  active?: string;
  onActive: (name?: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const updateScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollBack(rail.scrollLeft > 2);
    setCanScrollForward(
      rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [factions.length, updateScrollState]);

  if (!factions.length)
    return <div className="watch-faction-empty">No minor faction data</div>;
  const colours = assignFactionColours(factions);
  const scrollRail = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(260, railRef.current.clientWidth * 0.72),
      behavior: "smooth",
    });
  };
  return (
    <div className="watch-faction-rail-shell">
      <button
        type="button"
        className="watch-faction-scroll-button previous"
        onClick={() => scrollRail(-1)}
        disabled={!canScrollBack}
        aria-label="Scroll minor factions to the left"
        title="Previous minor factions"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div
        ref={railRef}
        className="watch-faction-rail"
        aria-label="Minor factions"
        onScroll={updateScrollState}
        onWheel={(event) => {
          const rail = event.currentTarget;
          const delta =
            Math.abs(event.deltaX) > Math.abs(event.deltaY)
              ? event.deltaX
              : event.deltaY;
          const canMove =
            (delta < 0 && rail.scrollLeft > 0) ||
            (delta > 0 &&
              rail.scrollLeft + rail.clientWidth < rail.scrollWidth);
          if (!canMove) return;
          event.preventDefault();
          rail.scrollLeft += delta;
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            scrollLeft: event.currentTarget.scrollLeft,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add("dragging");
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const distance = event.clientX - drag.startX;
          if (Math.abs(distance) > 3) {
            drag.moved = true;
            suppressClickRef.current = true;
          }
          event.currentTarget.scrollLeft = drag.scrollLeft - distance;
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          event.currentTarget.classList.remove("dragging");
          dragRef.current = null;
        }}
        onPointerCancel={(event) => {
          event.currentTarget.classList.remove("dragging");
          dragRef.current = null;
        }}
      >
        {factions.map((faction) => {
          const colour = colours.get(faction.name) ?? "#e8bd52";
          return (
            <article
              className={`watch-faction-card${active === faction.name ? " active" : active ? " muted" : ""}`}
              key={faction.name}
              style={factionFillStyle(faction, colour)}
              aria-label={`${faction.name}, influence ${faction.influence.toFixed(2)} percent`}
              tabIndex={0}
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                event.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                  inline: "center",
                });
              }}
              onMouseEnter={() => onActive(faction.name)}
              onMouseLeave={() => onActive(undefined)}
              onFocus={() => onActive(faction.name)}
              onBlur={() => onActive(undefined)}
            >
              <div className="watch-faction-primary">
                <strong title={faction.name}>
                  <i style={{ backgroundColor: colour }} />
                  {faction.name}
                </strong>
                <b>{faction.influence.toFixed(2)}%</b>
              </div>
              <div className="watch-faction-attributes">
                <div className="watch-faction-classification">
                  <BgsChip
                    icon={Building2}
                    label="Government"
                    value={faction.government}
                    kind="government"
                  />
                  <BgsChip
                    icon={Flag}
                    label="Allegiance"
                    value={faction.allegiance}
                    kind="allegiance"
                  />
                </div>
                <div className="watch-faction-status-line">
                  <BgsChip
                    icon={Zap}
                    label="Active"
                    value={faction.activeStates.join(", ") || "None"}
                    kind="status"
                    status="active"
                    showLabel
                  />
                </div>
                <div className="watch-faction-status-line">
                  <BgsChip
                    icon={Clock3}
                    label="Pending"
                    value={faction.pendingStates.join(", ") || "None"}
                    kind="status"
                    status="pending"
                    showLabel
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="watch-faction-scroll-button next"
        onClick={() => scrollRail(1)}
        disabled={!canScrollForward}
        aria-label="Scroll minor factions to the right"
        title="Next minor factions"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SystemStrip({
  scope,
  entry,
  system,
  tenantFactionName,
  presenceFactionNames,
  saving,
  onToggleFavorite,
  onDelete,
  onAddToPersonal,
  alreadyPersonal = false,
  personalWatchlistFull = false,
  onCreateRule,
  canRunBgsAi,
}: {
  scope: WatchlistScope;
  entry: SystemWatchlistEntry;
  system: WatchedSystem;
  tenantFactionName: string;
  presenceFactionNames?: string[];
  saving: boolean;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  onAddToPersonal?: () => void;
  alreadyPersonal?: boolean;
  personalWatchlistFull?: boolean;
  onCreateRule: () => void;
  canRunBgsAi: boolean;
}) {
  const [activeFaction, setActiveFaction] = useState<string>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const matchedPresenceFactions = useMemo(() => {
    const candidates = presenceFactionNames?.length
      ? presenceFactionNames
      : tenantFactionName
        ? [tenantFactionName]
        : [];
    return candidates.filter((name) => hasTenantFaction(system, name));
  }, [presenceFactionNames, system, tenantFactionName]);
  const tenantFactionPresent = matchedPresenceFactions.length > 0;
  const presenceDescription = matchedPresenceFactions.join(", ");
  return (
    <article
      className={`system-watch-strip${system.available ? "" : " unavailable"}${entry.favorite ? " favorite" : ""}${tenantFactionPresent ? " tenant-present" : ""}`}
    >
      <header className="watch-system-summary">
        <div className="watch-system-identity">
          <div className="watch-system-identity-primary">
            {tenantFactionPresent && (
              <span
                className="tenant-presence-badge"
                title={`${presenceDescription} ${matchedPresenceFactions.length === 1 ? "is" : "are"} present in this system`}
                aria-label={`${presenceDescription} ${matchedPresenceFactions.length === 1 ? "is" : "are"} present in this system`}
              >
                <ShieldCheck size={13} aria-hidden="true" />
              </span>
            )}
            {system.conflicts.length > 0 && (
              <span
                className="watch-conflict-badge"
                title={`${system.conflicts.length} current conflict${system.conflicts.length === 1 ? "" : "s"}: ${system.conflicts
                  .map(
                    (conflict) =>
                      `${conflict.faction1} vs. ${conflict.faction2}`,
                  )
                  .join(", ")}`}
                aria-label={`${system.conflicts.length} current conflict${system.conflicts.length === 1 ? "" : "s"}`}
              >
                <Swords size={13} aria-hidden="true" />
              </span>
            )}
            <strong>{system.name}</strong>
            <CopyTextButton value={system.name} label="Copy system name" />
          </div>
          {(entry.sector || entry.projectName) && (
            <span
              className="watch-system-context"
              title={[entry.sector, entry.projectName]
                .filter(Boolean)
                .join(" / ")}
            >
              {[entry.sector, entry.projectName].filter(Boolean).join(" / ")}
            </span>
          )}
        </div>
        {system.available ? (
          <div className="watch-system-facts">
            <span className="watch-controller" title="Controlling faction">
              {system.controllingFaction || "No controlling faction"}
            </span>
            <BgsChip
              icon={Flag}
              label="Allegiance"
              value={system.allegiance}
              kind="allegiance"
            />
            <BgsChip
              icon={Building2}
              label="Government"
              value={system.government}
              kind="government"
            />
            <span className="watch-plain-fact" title="Population">
              <Users size={10} /> {formatPopulation(system.population)}
            </span>
            <BgsChip
              icon={Factory}
              label="Economy"
              value={system.economy}
              kind="economy"
            />
            <span className="watch-plain-fact" title="Information updated">
              <Clock3 size={10} /> {formatUpdated(system.updatedAt)}
            </span>
          </div>
        ) : (
          <span className="watch-unavailable-label">No EDDN system data</span>
        )}
        <div className="watch-system-actions">
          <button
            type="button"
            className="watch-rule-button"
            onClick={onCreateRule}
            aria-label={`Create an alert rule for ${entry.system}`}
            title="Create alert rule"
          >
            <BellRing size={14} aria-hidden="true" />
          </button>
          {scope !== "personal" && system.available && (
            <button
              type="button"
              className="watch-ai-button"
              onClick={() => setAiOpen(true)}
              aria-label={`Open BGS AI intelligence for ${entry.system}`}
              title="Open BGS AI intelligence"
            >
              <Bot size={14} aria-hidden="true" />
            </button>
          )}
          {scope === "personal" ? (
            <button
              type="button"
              className="watch-favorite-button"
              data-favorite={entry.favorite || undefined}
              onClick={onToggleFavorite}
              disabled={saving}
              aria-pressed={entry.favorite}
              aria-label={`${entry.favorite ? "Remove" : "Add"} ${entry.system} ${entry.favorite ? "from" : "to"} favorites`}
              title={
                entry.favorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              <Star
                size={14}
                fill={entry.favorite ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          ) : (
            <button
              type="button"
              className="watch-add-personal-button"
              data-added={alreadyPersonal || undefined}
              onClick={onAddToPersonal}
              disabled={saving || alreadyPersonal || personalWatchlistFull}
              aria-label={
                alreadyPersonal
                  ? `${entry.system} is already on your personal watchlist`
                  : `Add ${entry.system} to your personal watchlist`
              }
              title={
                alreadyPersonal
                  ? "Already on your personal watchlist"
                  : personalWatchlistFull
                    ? "Your personal watchlist already contains 100 systems"
                    : "Add to personal watchlist"
              }
            >
              {alreadyPersonal ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
            </button>
          )}
          <Link
            href={`/intelligence/systems?system=${encodeURIComponent(entry.system)}`}
            aria-label={`Open full system information for ${entry.system}`}
            title="Open full system information"
          >
            <ExternalLink size={13} />
          </Link>
          <button
            type="button"
            className="watch-map-button"
            onClick={() => setMapOpen(true)}
            aria-label={`Show EDGIS system map for ${entry.system}`}
            title="Show EDGIS system map"
          >
            <MapIcon size={14} aria-hidden="true" />
          </button>
          {system.available && (
            <button
              type="button"
              className="watch-history-button"
              onClick={() => setDetailOpen(true)}
              aria-label={`Open record detail and influence history for ${entry.system}`}
              title="Open record detail and influence history"
            >
              <History size={14} aria-hidden="true" />
            </button>
          )}
          {scope === "personal" && (
            <button
              type="button"
              className="watch-delete-button"
              onClick={onDelete}
              disabled={saving}
              aria-label={`Remove ${entry.system} from the watchlist`}
              title="Remove from watchlist"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </header>
      {system.available && (
        <FactionRail
          factions={system.factions}
          active={activeFaction}
          onActive={setActiveFaction}
        />
      )}
      <SystemRecordDetail
        system={system}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canRunBgsAi={canRunBgsAi}
      />
      <EdgisSystemMapDialog
        system={system.name}
        open={mapOpen}
        onOpenChange={setMapOpen}
      />
      <BgsAiDialog
        system={system.name}
        open={aiOpen}
        onOpenChange={setAiOpen}
        canRun={canRunBgsAi}
      />
    </article>
  );
}

function AddSystemDialog({
  open,
  onOpenChange,
  existing,
  onAdd,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: SystemWatchlistEntry[];
  onAdd: (entry: SystemWatchlistEntry) => void;
  saving: boolean;
}) {
  const [system, setSystem] = useState("");
  const [sector, setSector] = useState("");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content watchlist-dialog">
          <Dialog.Title>Add monitored system</Dialog.Title>
          <Dialog.Description>
            System names are matched exactly against the EDDN database. Sector
            and project are optional labels.
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = systemWatchlistEntrySchema.safeParse({
                system,
                sector,
                projectName,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Invalid system");
                return;
              }
              if (
                existing.some(
                  (entry) =>
                    entry.system.toLocaleLowerCase("en") ===
                    parsed.data.system.toLocaleLowerCase("en"),
                )
              ) {
                setError("This system is already on your watchlist");
                return;
              }
              setError("");
              onAdd(parsed.data);
              setSystem("");
              setSector("");
              setProjectName("");
            }}
          >
            <label>
              <span>System name</span>
              <input
                autoFocus
                value={system}
                onChange={(event) => setSystem(event.target.value)}
                placeholder="HIP 91987"
              />
            </label>
            <label>
              <span>Sector</span>
              <input
                value={sector}
                onChange={(event) => setSector(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              <span>Project name</span>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Optional"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="secondary-button">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                <Plus size={14} /> Add system
              </button>
            </div>
          </form>
          <Dialog.Close className="dialog-close" aria-label="Close dialog">
            <X size={17} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WatchlistFilterSheet({
  open,
  onOpenChange,
  scope,
  filters,
  sectors,
  allegianceOptions,
  governmentOptions,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: WatchlistScope;
  filters: WatchlistFilters;
  sectors: string[];
  allegianceOptions: GlobalWatchlistFilterOption[];
  governmentOptions: GlobalWatchlistFilterOption[];
  onApply: (filters: WatchlistFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const update = (field: keyof WatchlistFilters, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setDraft(filters);
        onOpenChange(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content watchlist-filter-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>
                Filter{" "}
                {scope === "personal"
                  ? "personal"
                  : scope === "global"
                    ? "global"
                    : "protected-faction"}{" "}
                watchlist
              </Dialog.Title>
              <Dialog.Description>
                Filters apply to the current system facts. Empty fields include
                every value.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close watchlist filters">
              <X size={19} />
            </Dialog.Close>
          </div>
          <form
            className="filter-form watchlist-filter-form"
            onSubmit={(event) => {
              event.preventDefault();
              onApply(draft);
              onOpenChange(false);
            }}
          >
            <label>
              <span>System name</span>
              <input
                value={draft.system}
                onChange={(event) => update("system", event.target.value)}
                placeholder={
                  scope === "personal"
                    ? "System, sector or project"
                    : "System name contains…"
                }
              />
            </label>
            <label>
              <span>Controlling minor faction</span>
              <input
                value={draft.controllingFaction}
                onChange={(event) =>
                  update("controllingFaction", event.target.value)
                }
                placeholder="Faction name contains…"
              />
            </label>
            <div className="watchlist-filter-range">
              <label>
                <span>Population from</span>
                <input
                  type="number"
                  min="0"
                  value={draft.populationMin}
                  onChange={(event) =>
                    update("populationMin", event.target.value)
                  }
                  placeholder="No minimum"
                />
              </label>
              <label>
                <span>Population to</span>
                <input
                  type="number"
                  min="0"
                  value={draft.populationMax}
                  onChange={(event) =>
                    update("populationMax", event.target.value)
                  }
                  placeholder="No maximum"
                />
              </label>
            </div>
            <div className="watchlist-filter-range">
              <label>
                <span>Updated from</span>
                <input
                  type="date"
                  value={draft.updatedFrom}
                  onChange={(event) =>
                    update("updatedFrom", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Updated to</span>
                <input
                  type="date"
                  value={draft.updatedTo}
                  onChange={(event) => update("updatedTo", event.target.value)}
                />
              </label>
            </div>
            <label>
              <span>Allegiance</span>
              <select
                value={draft.allegiance}
                onChange={(event) => update("allegiance", event.target.value)}
              >
                <option value="">All allegiances</option>
                {allegianceOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Government</span>
              <select
                value={draft.government}
                onChange={(event) => update("government", event.target.value)}
              >
                <option value="">All governments</option>
                {governmentOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {scope === "personal" && (
              <label>
                <span>Sector</span>
                <select
                  value={draft.sector}
                  onChange={(event) => update("sector", event.target.value)}
                >
                  <option value="">All sectors</option>
                  {sectors.map((sector) => (
                    <option value={sector} key={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <footer>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDraft({ ...emptyWatchlistFilters })}
              >
                Reset
              </button>
              <Dialog.Close asChild>
                <button className="secondary-button" type="button">
                  Cancel
                </button>
              </Dialog.Close>
              <button className="primary-button" type="submit">
                Apply filters
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PersonalSystemWatchlist({
  active,
  tenantFactionName,
  canManageTenantRules,
  canRunBgsAi,
  viewFilters,
  viewSortField,
  viewSortDescending,
  onViewChange,
}: {
  active: boolean;
  tenantFactionName: string;
  canManageTenantRules: boolean;
  canRunBgsAi: boolean;
} & WatchlistViewProps) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleSystem, setRuleSystem] = useState<string>();
  const filters = viewFilters;
  const sortField = watchlistSortOptions.some(
    (option) => option.value === viewSortField,
  )
    ? (viewSortField as WatchlistSortField)
    : "system";
  const sortDescending = viewSortDescending;
  const setFilters = (change: SetStateAction<WatchlistFilters>) =>
    onViewChange({
      filters: typeof change === "function" ? change(filters) : change,
    });
  const setSortField = (next: WatchlistSortField) =>
    onViewChange({ sortField: next });
  const setSortDescending = (change: SetStateAction<boolean>) =>
    onViewChange({
      sortDescending:
        typeof change === "function" ? change(sortDescending) : change,
    });
  const query = useQuery({
    queryKey: ["system-watchlist-data"],
    queryFn: loadWatchlist,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: saveWatchlist,
    onMutate: async (systems) => {
      await queryClient.cancelQueries({ queryKey: ["system-watchlist-data"] });
      const previous = queryClient.getQueryData<WatchlistPayload>([
        "system-watchlist-data",
      ]);
      queryClient.setQueryData<WatchlistPayload>(
        ["system-watchlist-data"],
        (current) => (current ? { ...current, watchlist: systems } : current),
      );
      return { previous };
    },
    onError: (_error, _systems, context) => {
      if (context?.previous)
        queryClient.setQueryData(["system-watchlist-data"], context.previous);
    },
    onSuccess: async () => {
      setAddOpen(false);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["system-watchlist-data"],
      });
    },
  });
  const watchlist = useMemo(
    () => query.data?.watchlist ?? [],
    [query.data?.watchlist],
  );
  const systemMap = new Map(
    (query.data?.systems ?? []).map((system) => [
      system.requestedSystem.toLocaleLowerCase("en"),
      system,
    ]),
  );
  const sectors = useMemo(
    () =>
      [
        ...new Set(watchlist.map((entry) => entry.sector).filter(Boolean)),
      ].sort(),
    [watchlist],
  );
  const filtered = sortWatchlistEntries(
    watchlist.filter((entry) =>
      matchesWatchlistFilters(
        entry,
        systemMap.get(entry.system.toLocaleLowerCase("en")),
        filters,
      ),
    ),
    query.data?.systems ?? [],
    sortField,
    sortDescending,
  );
  const favoriteCount = watchlist.filter((entry) => entry.favorite).length;
  const allegianceOptions = useMemo(
    () => filterOptionValues(query.data?.systems ?? [], "allegiance"),
    [query.data?.systems],
  );
  const governmentOptions = useMemo(
    () => filterOptionValues(query.data?.systems ?? [], "government"),
    [query.data?.systems],
  );
  const statistics = useMemo(
    () =>
      calculateWatchlistStatistics(
        query.data?.systems ?? [],
        watchlist.length,
        query.data?.facilityStatistics,
      ),
    [query.data?.facilityStatistics, query.data?.systems, watchlist.length],
  );

  return (
    <>
      <header className="page-header watchlist-page-header">
        <div>
          <p className="eyebrow">INTELLIGENCE / PERSONAL BGS WATCHLIST</p>
          <h1>System watchlist</h1>
          <p>
            Your tenant-specific systems with current EDDN faction data and
            on-demand seven-day influence history.
          </p>
        </div>
        <div>
          <span className="live-status">
            <i /> 60s refresh
          </span>
          <button
            className="secondary-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "spin" : ""} size={15} />
            Refresh
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setRuleSystem(undefined);
              setRulesOpen(true);
            }}
          >
            <BellRing size={15} /> Rules
          </button>
          <small>
            {query.data?.generatedAt
              ? `Updated ${formatUpdated(query.data.generatedAt)}`
              : "Loading your watchlist…"}
          </small>
        </div>
      </header>

      <section className="surface watchlist-toolbar">
        <div className="watchlist-summary">
          <strong>{watchlist.length}</strong>
          <span>monitored systems</span>
          <button
            type="button"
            className="watchlist-statistics-button"
            onClick={() => setStatisticsOpen(true)}
            disabled={!watchlist.length}
            title="Open statistics for all monitored systems"
          >
            <ChartColumn size={13} aria-hidden="true" />
            Statistics
          </button>
          {favoriteCount > 0 && (
            <span className="watchlist-favorite-count">
              <Star size={10} fill="currentColor" aria-hidden="true" />
              {favoriteCount}
              <span className="sr-only">favorites</span>
            </span>
          )}
          {tenantFactionName && (
            <span
              className="watchlist-presence-key"
              title={`Systems containing ${tenantFactionName}`}
            >
              <ShieldCheck size={13} aria-hidden="true" />
              <span>Tenant faction present</span>
            </span>
          )}
        </div>
        <button
          type="button"
          className="watchlist-filter-button"
          onClick={() => setFilterOpen(true)}
        >
          <ListFilter size={14} aria-hidden="true" />
          Filters
          {activeFilterCount(filters, "personal") > 0 && (
            <span>{activeFilterCount(filters, "personal")}</span>
          )}
        </button>
        <div className="watchlist-sort-controls">
          <label>
            <span className="sr-only">Sort monitored systems by</span>
            <select
              value={sortField}
              onChange={(event) =>
                setSortField(event.target.value as WatchlistSortField)
              }
              aria-label="Sort monitored systems by"
            >
              {watchlistSortOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDescending((current) => !current)}
            aria-label={`Sort ${sortDescending ? "ascending" : "descending"}`}
            title={`Currently ${sortDescending ? "descending" : "ascending"}; click to reverse`}
          >
            <ArrowDownUp size={14} aria-hidden="true" />
            <span>{sortDescending ? "Descending" : "Ascending"}</span>
          </button>
        </div>
        <button className="primary-button" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Add system
        </button>
      </section>

      {(query.isError || mutation.isError) && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not update the system watchlist</strong>
            <span>{query.error?.message ?? mutation.error?.message}</span>
          </div>
          <button onClick={() => query.refetch()}>Retry</button>
        </div>
      )}

      {!query.isLoading && !watchlist.length && !query.isError && (
        <section className="surface watchlist-empty">
          <Activity size={24} />
          <div>
            <strong>No monitored systems yet</strong>
            <span>
              Add an exact EDDN system name to start your personal BGS
              watchlist.
            </span>
          </div>
          <button className="primary-button" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add first system
          </button>
        </section>
      )}

      <section className="system-watch-list" aria-busy={query.isLoading}>
        {query.isLoading && (
          <p className="inline-empty">Loading monitored systems…</p>
        )}
        {filtered.map((entry) => {
          const system = systemMap.get(
            entry.system.toLocaleLowerCase("en"),
          ) ?? {
            requestedSystem: entry.system,
            available: false,
            name: entry.system,
            controllingFaction: "",
            allegiance: "",
            government: "",
            population: 0,
            economy: "",
            security: "",
            powerplayPowers: [],
            updatedAt: "",
            factions: [],
            conflicts: [],
          };
          return (
            <SystemStrip
              scope="personal"
              key={entry.system.toLocaleLowerCase("en")}
              entry={entry}
              system={system}
              tenantFactionName={tenantFactionName}
              saving={mutation.isPending}
              canRunBgsAi={canRunBgsAi}
              onCreateRule={() => {
                setRuleSystem(entry.system);
                setRulesOpen(true);
              }}
              onToggleFavorite={() =>
                mutation.mutate(
                  watchlist.map((candidate) =>
                    candidate.system.toLocaleLowerCase("en") ===
                    entry.system.toLocaleLowerCase("en")
                      ? { ...candidate, favorite: !candidate.favorite }
                      : candidate,
                  ),
                )
              }
              onDelete={() =>
                mutation.mutate(
                  watchlist.filter(
                    (candidate) =>
                      candidate.system.toLocaleLowerCase("en") !==
                      entry.system.toLocaleLowerCase("en"),
                  ),
                )
              }
            />
          );
        })}
      </section>

      <AddSystemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existing={watchlist}
        saving={mutation.isPending}
        onAdd={(entry) => mutation.mutate([...watchlist, entry])}
      />
      <WatchlistFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        scope="personal"
        filters={filters}
        sectors={sectors}
        allegianceOptions={allegianceOptions}
        governmentOptions={governmentOptions}
        onApply={setFilters}
      />
      <WatchlistStatisticsDialog
        statistics={statistics}
        open={statisticsOpen}
        onOpenChange={setStatisticsOpen}
      />
      <BgsRuleManager
        key={`${ruleSystem ?? "global"}-${rulesOpen ? "open" : "closed"}`}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        initialSystem={ruleSystem}
        systems={watchlist.map((entry) => entry.system)}
        canManageTenant={canManageTenantRules}
      />
    </>
  );
}

function GlobalSystemWatchlist({
  active,
  tenantFactionName,
  canManageTenantRules,
  canRunBgsAi,
  viewFilters,
  viewSortField,
  viewSortDescending,
  onViewChange,
}: {
  active: boolean;
  tenantFactionName: string;
  canManageTenantRules: boolean;
  canRunBgsAi: boolean;
} & WatchlistViewProps) {
  const queryClient = useQueryClient();
  const [filterOpen, setFilterOpen] = useState(false);
  const filters = viewFilters;
  const sortField = globalWatchlistSortOptions.some(
    (option) => option.value === viewSortField,
  )
    ? (viewSortField as GlobalWatchlistSortField)
    : "system";
  const sortDescending = viewSortDescending;
  const setFilters = (change: SetStateAction<WatchlistFilters>) =>
    onViewChange({
      filters: typeof change === "function" ? change(filters) : change,
    });
  const setSortField = (next: GlobalWatchlistSortField) =>
    onViewChange({ sortField: next });
  const setSortDescending = (change: SetStateAction<boolean>) =>
    onViewChange({
      sortDescending:
        typeof change === "function" ? change(sortDescending) : change,
    });
  const [page, setPage] = useState(1);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleSystem, setRuleSystem] = useState<string>();
  const personalQuery = useQuery({
    queryKey: ["system-watchlist-data"],
    queryFn: loadWatchlist,
    refetchInterval: false,
  });
  const query = useQuery({
    queryKey: [
      "system-watchlist-global",
      page,
      sortField,
      sortDescending,
      filters,
    ],
    queryFn: () =>
      loadGlobalWatchlist(page, sortField, sortDescending, filters),
    enabled: active,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: saveWatchlist,
    onMutate: async (systems) => {
      await queryClient.cancelQueries({ queryKey: ["system-watchlist-data"] });
      const previous = queryClient.getQueryData<WatchlistPayload>([
        "system-watchlist-data",
      ]);
      queryClient.setQueryData<WatchlistPayload>(
        ["system-watchlist-data"],
        (current) => (current ? { ...current, watchlist: systems } : current),
      );
      return { previous };
    },
    onError: (_error, _systems, context) => {
      if (context?.previous)
        queryClient.setQueryData(["system-watchlist-data"], context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["system-watchlist-data"],
      });
    },
  });
  const personalWatchlist = useMemo(
    () => personalQuery.data?.watchlist ?? [],
    [personalQuery.data?.watchlist],
  );
  const personalSystems = useMemo(
    () =>
      new Set(
        personalWatchlist.map((entry) => entry.system.toLocaleLowerCase("en")),
      ),
    [personalWatchlist],
  );
  const total = query.data?.pagination.total ?? 0;
  const pageSize = query.data?.pagination.pageSize ?? globalWatchlistPageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);
  const ruleSystems = [
    ...new Set([
      ...personalWatchlist.map((entry) => entry.system),
      ...(ruleSystem ? [ruleSystem] : []),
    ]),
  ].sort((left, right) => left.localeCompare(right, "en"));

  return (
    <>
      <header className="page-header watchlist-page-header">
        <div>
          <p className="eyebrow">INTELLIGENCE / GLOBAL BGS WATCHLIST</p>
          <h1>Global system watchlist</h1>
          <p>
            Every system containing {tenantFactionName}, with current EDDN
            faction data and seven-day influence history.
          </p>
        </div>
        <div>
          <span className="live-status">
            <i /> 60s refresh
          </span>
          <button
            className="secondary-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "spin" : ""} size={15} />
            Refresh
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setRuleSystem(undefined);
              setRulesOpen(true);
            }}
          >
            <BellRing size={15} /> Rules
          </button>
          <small>
            {query.data?.generatedAt
              ? `Updated ${formatUpdated(query.data.generatedAt)}`
              : "Loading the global watchlist…"}
          </small>
        </div>
      </header>

      <section className="surface watchlist-toolbar watchlist-toolbar-global">
        <div className="watchlist-summary">
          <strong>{total}</strong>
          <span>tenant-faction systems</span>
          <span
            className="watchlist-presence-key"
            title={`Systems containing ${tenantFactionName}`}
          >
            <ShieldCheck size={13} aria-hidden="true" />
            <span>{tenantFactionName}</span>
          </span>
        </div>
        <button
          type="button"
          className="watchlist-filter-button"
          onClick={() => setFilterOpen(true)}
        >
          <ListFilter size={14} aria-hidden="true" />
          Filters
          {activeFilterCount(filters, "global") > 0 && (
            <span>{activeFilterCount(filters, "global")}</span>
          )}
        </button>
        <div className="watchlist-sort-controls">
          <label>
            <span className="sr-only">Sort global systems by</span>
            <select
              value={sortField}
              onChange={(event) => {
                setSortField(event.target.value as GlobalWatchlistSortField);
                setPage(1);
              }}
              aria-label="Sort global systems by"
            >
              {globalWatchlistSortOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSortDescending((current) => !current);
              setPage(1);
            }}
            aria-label={`Sort ${sortDescending ? "ascending" : "descending"}`}
            title={`Currently ${sortDescending ? "descending" : "ascending"}; click to reverse`}
          >
            <ArrowDownUp size={14} aria-hidden="true" />
            <span>{sortDescending ? "Descending" : "Ascending"}</span>
          </button>
        </div>
      </section>

      {(query.isError || mutation.isError || personalQuery.isError) && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not load the global system watchlist</strong>
            <span>
              {query.error?.message ??
                mutation.error?.message ??
                personalQuery.error?.message}
            </span>
          </div>
          <button onClick={() => query.refetch()}>Retry</button>
        </div>
      )}

      {!query.isLoading && !query.isError && total === 0 && (
        <section className="surface watchlist-empty">
          <Activity size={24} />
          <div>
            <strong>No matching tenant-faction systems</strong>
            <span>
              Clear filters or wait for the next EDDN update for{" "}
              {tenantFactionName}.
            </span>
          </div>
        </section>
      )}

      <section className="system-watch-list" aria-busy={query.isLoading}>
        {query.isLoading && (
          <p className="inline-empty">Loading tenant-faction systems…</p>
        )}
        {(query.data?.systems ?? []).map((system) => {
          const entry: SystemWatchlistEntry = {
            system: system.requestedSystem || system.name,
            sector: "",
            projectName: "",
            favorite: false,
          };
          const alreadyPersonal = personalSystems.has(
            entry.system.toLocaleLowerCase("en"),
          );
          return (
            <SystemStrip
              scope="global"
              key={entry.system.toLocaleLowerCase("en")}
              entry={entry}
              system={system}
              tenantFactionName={tenantFactionName}
              saving={mutation.isPending}
              canRunBgsAi={canRunBgsAi}
              alreadyPersonal={alreadyPersonal}
              personalWatchlistFull={personalWatchlist.length >= 100}
              onAddToPersonal={() => {
                if (alreadyPersonal || personalWatchlist.length >= 100) return;
                mutation.mutate([...personalWatchlist, entry]);
              }}
              onCreateRule={() => {
                setRuleSystem(entry.system);
                setRulesOpen(true);
              }}
            />
          );
        })}
      </section>

      {total > 0 && (
        <nav
          className="surface watchlist-pagination"
          aria-label="Global watchlist pages"
        >
          <span>
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
            {total.toLocaleString()}
          </span>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <strong>
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || query.isFetching}
            >
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      <WatchlistFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        scope="global"
        filters={filters}
        sectors={[]}
        allegianceOptions={query.data?.filterOptions.allegiances ?? []}
        governmentOptions={query.data?.filterOptions.governments ?? []}
        onApply={(nextFilters) => {
          setFilters({ ...nextFilters, sector: "" });
          setPage(1);
        }}
      />
      <BgsRuleManager
        key={`${ruleSystem ?? "global"}-${rulesOpen ? "open" : "closed"}`}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        initialSystem={ruleSystem}
        systems={ruleSystems}
        canManageTenant={canManageTenantRules}
      />
    </>
  );
}

function ProtectedFactionsSystemWatchlist({
  active,
  tenantFactionName,
  canManageTenantRules,
  canRunBgsAi,
  viewFilters,
  viewSortField,
  viewSortDescending,
  viewProtectedFactionId,
  onViewChange,
}: {
  active: boolean;
  tenantFactionName: string;
  canManageTenantRules: boolean;
  canRunBgsAi: boolean;
} & WatchlistViewProps) {
  const queryClient = useQueryClient();
  const [filterOpen, setFilterOpen] = useState(false);
  const filters = viewFilters;
  const sortField = globalWatchlistSortOptions.some(
    (option) => option.value === viewSortField,
  )
    ? (viewSortField as GlobalWatchlistSortField)
    : "system";
  const sortDescending = viewSortDescending;
  const setFilters = (change: SetStateAction<WatchlistFilters>) =>
    onViewChange({
      filters: typeof change === "function" ? change(filters) : change,
    });
  const setSortField = (next: GlobalWatchlistSortField) =>
    onViewChange({ sortField: next });
  const setSortDescending = (change: SetStateAction<boolean>) =>
    onViewChange({
      sortDescending:
        typeof change === "function" ? change(sortDescending) : change,
    });
  const selectedFactionId = viewProtectedFactionId;
  const setSelectedFactionId = (value: number | null) =>
    onViewChange({ protectedFactionId: value });
  const [page, setPage] = useState(1);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleSystem, setRuleSystem] = useState<string>();
  const personalQuery = useQuery({
    queryKey: ["system-watchlist-data"],
    queryFn: loadWatchlist,
    refetchInterval: false,
  });
  const query = useQuery({
    queryKey: [
      "system-watchlist-protected",
      selectedFactionId,
      page,
      sortField,
      sortDescending,
      filters,
    ],
    queryFn: () =>
      loadProtectedWatchlist(
        page,
        sortField,
        sortDescending,
        filters,
        selectedFactionId,
      ),
    enabled: active,
    placeholderData: (previous) => previous,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: saveWatchlist,
    onMutate: async (systems) => {
      await queryClient.cancelQueries({ queryKey: ["system-watchlist-data"] });
      const previous = queryClient.getQueryData<WatchlistPayload>([
        "system-watchlist-data",
      ]);
      queryClient.setQueryData<WatchlistPayload>(
        ["system-watchlist-data"],
        (current) => (current ? { ...current, watchlist: systems } : current),
      );
      return { previous };
    },
    onError: (_error, _systems, context) => {
      if (context?.previous)
        queryClient.setQueryData(["system-watchlist-data"], context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["system-watchlist-data"],
      });
    },
  });
  const personalWatchlist = useMemo(
    () => personalQuery.data?.watchlist ?? [],
    [personalQuery.data?.watchlist],
  );
  const personalSystems = useMemo(
    () =>
      new Set(
        personalWatchlist.map((entry) => entry.system.toLocaleLowerCase("en")),
      ),
    [personalWatchlist],
  );
  const protectedFactions = query.data?.protectedFactions ?? [];
  const selectedFaction = protectedFactions.find(
    (faction) => faction.id === selectedFactionId,
  );
  const presenceFactionNames = selectedFaction
    ? [selectedFaction.name]
    : protectedFactions.map((faction) => faction.name);
  const total = query.data?.pagination.total ?? 0;
  const pageSize = query.data?.pagination.pageSize ?? globalWatchlistPageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);
  const filterCount = activeFilterCount(filters, "protected");
  const ruleSystems = [
    ...new Set([
      ...personalWatchlist.map((entry) => entry.system),
      ...(ruleSystem ? [ruleSystem] : []),
    ]),
  ].sort((left, right) => left.localeCompare(right, "en"));

  return (
    <>
      <header className="page-header watchlist-page-header">
        <div>
          <p className="eyebrow">INTELLIGENCE / PROTECTED FACTIONS WATCHLIST</p>
          <h1>Protected factions watchlist</h1>
          <p>
            Systems containing active protected factions, with current EDDN
            faction data and seven-day influence history.
          </p>
        </div>
        <div>
          <span className="live-status">
            <i /> 60s refresh
          </span>
          <button
            className="secondary-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? "spin" : ""} size={15} />
            Refresh
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setRuleSystem(undefined);
              setRulesOpen(true);
            }}
          >
            <BellRing size={15} /> Rules
          </button>
          <small>
            {query.data?.generatedAt
              ? `Updated ${formatUpdated(query.data.generatedAt)}`
              : "Loading protected factions…"}
          </small>
        </div>
      </header>

      <section className="surface watchlist-toolbar watchlist-toolbar-global watchlist-toolbar-protected">
        <div className="watchlist-summary">
          <strong>{total}</strong>
          <span>protected-faction systems</span>
          <span
            className="watchlist-presence-key"
            title={
              selectedFaction
                ? `Systems containing ${selectedFaction.name}`
                : "Systems containing any active protected faction"
            }
          >
            <ShieldCheck size={13} aria-hidden="true" />
            <span>{selectedFaction?.name ?? "All protected factions"}</span>
          </span>
        </div>
        <label className="watchlist-protected-select">
          <span>Protected faction</span>
          <select
            aria-label="Protected faction"
            value={selectedFactionId ?? "all"}
            onChange={(event) => {
              setSelectedFactionId(
                event.target.value === "all"
                  ? null
                  : Number(event.target.value),
              );
              setPage(1);
            }}
          >
            <option value="all">All protected factions</option>
            {protectedFactions.map((faction) => (
              <option value={faction.id} key={faction.id}>
                {faction.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="watchlist-filter-button"
          onClick={() => setFilterOpen(true)}
        >
          <ListFilter size={14} aria-hidden="true" />
          Filters
          {filterCount > 0 && <span>{filterCount}</span>}
        </button>
        <div className="watchlist-sort-controls">
          <label>
            <span className="sr-only">Sort protected-faction systems by</span>
            <select
              value={sortField}
              onChange={(event) => {
                setSortField(event.target.value as GlobalWatchlistSortField);
                setPage(1);
              }}
              aria-label="Sort protected-faction systems by"
            >
              {globalWatchlistSortOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSortDescending((current) => !current);
              setPage(1);
            }}
            aria-label={`Sort ${sortDescending ? "ascending" : "descending"}`}
            title={`Currently ${sortDescending ? "descending" : "ascending"}; click to reverse`}
          >
            <ArrowDownUp size={14} aria-hidden="true" />
            <span>{sortDescending ? "Descending" : "Ascending"}</span>
          </button>
        </div>
      </section>

      {(query.isError || mutation.isError || personalQuery.isError) && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not load the protected-faction watchlist</strong>
            <span>
              {query.error?.message ??
                mutation.error?.message ??
                personalQuery.error?.message}
            </span>
          </div>
          <button onClick={() => query.refetch()}>Retry</button>
        </div>
      )}

      {!query.isLoading && !query.isError && !protectedFactions.length && (
        <section className="surface watchlist-empty">
          <ShieldCheck size={24} />
          <div>
            <strong>No active protected factions</strong>
            <span>
              Add or activate a protected faction on the EICFlaskServer first.
            </span>
          </div>
        </section>
      )}

      {!query.isLoading &&
        !query.isError &&
        protectedFactions.length > 0 &&
        total === 0 && (
          <section className="surface watchlist-empty">
            <Activity size={24} />
            <div>
              <strong>
                {filterCount > 0
                  ? "No matching protected-faction systems"
                  : selectedFaction
                    ? "Faction currently has no EDDN systems"
                    : "No protected-faction systems available"}
              </strong>
              <span>
                {filterCount > 0
                  ? "Clear filters to show all available systems."
                  : selectedFaction
                    ? `No current EDDN system contains ${selectedFaction.name}.`
                    : "Wait for the next EDDN faction update."}
              </span>
            </div>
          </section>
        )}

      <section className="system-watch-list" aria-busy={query.isLoading}>
        {query.isLoading && (
          <p className="inline-empty">Loading protected-faction systems…</p>
        )}
        {(query.data?.systems ?? []).map((system) => {
          const entry: SystemWatchlistEntry = {
            system: system.requestedSystem || system.name,
            sector: "",
            projectName: "",
            favorite: false,
          };
          const alreadyPersonal = personalSystems.has(
            entry.system.toLocaleLowerCase("en"),
          );
          return (
            <SystemStrip
              scope="protected"
              key={entry.system.toLocaleLowerCase("en")}
              entry={entry}
              system={system}
              tenantFactionName={tenantFactionName}
              presenceFactionNames={presenceFactionNames}
              saving={mutation.isPending}
              canRunBgsAi={canRunBgsAi}
              alreadyPersonal={alreadyPersonal}
              personalWatchlistFull={personalWatchlist.length >= 100}
              onAddToPersonal={() => {
                if (alreadyPersonal || personalWatchlist.length >= 100) return;
                mutation.mutate([...personalWatchlist, entry]);
              }}
              onCreateRule={() => {
                setRuleSystem(entry.system);
                setRulesOpen(true);
              }}
            />
          );
        })}
      </section>

      {total > 0 && (
        <nav
          className="surface watchlist-pagination"
          aria-label="Protected-faction watchlist pages"
        >
          <span>
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
            {total.toLocaleString()}
          </span>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            <strong>
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </strong>
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || query.isFetching}
            >
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      <WatchlistFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        scope="protected"
        filters={filters}
        sectors={[]}
        allegianceOptions={query.data?.filterOptions.allegiances ?? []}
        governmentOptions={query.data?.filterOptions.governments ?? []}
        onApply={(nextFilters) => {
          setFilters({ ...nextFilters, sector: "" });
          setPage(1);
        }}
      />
      <BgsRuleManager
        key={`${ruleSystem ?? "protected"}-${rulesOpen ? "open" : "closed"}`}
        open={rulesOpen}
        onOpenChange={setRulesOpen}
        initialSystem={ruleSystem}
        systems={ruleSystems}
        canManageTenant={canManageTenantRules}
      />
    </>
  );
}

export function SystemWatchlist({
  tenantFactionName,
  canManageTenantRules,
  canRunBgsAi,
}: {
  tenantFactionName: string;
  canManageTenantRules: boolean;
  canRunBgsAi: boolean;
}) {
  const queryClient = useQueryClient();
  const [viewGeneration, setViewGeneration] = useState(0);
  const defaults = useMemo<ViewPreference>(
    () => ({
      filters: {},
      sorting: [{ id: "system", desc: false }],
      visibleColumns: [],
      pageSize: 25,
      variant: "personal",
    }),
    [],
  );
  const savedView = useStoredViewPreference(
    "bgs-system-watchlist-view-state",
    defaults,
    undefined,
    "bgs-system-watchlist-sort",
  );
  const scope: WatchlistScope = ["personal", "global", "protected"].includes(
    savedView.view.variant ?? "",
  )
    ? (savedView.view.variant as WatchlistScope)
    : "personal";
  const filters = useMemo(
    () =>
      Object.fromEntries(
        (
          Object.keys(emptyWatchlistFilters) as Array<keyof WatchlistFilters>
        ).map((key) => [key, viewFilterString(savedView.view.filters[key])]),
      ) as unknown as WatchlistFilters,
    [savedView.view.filters],
  );
  const sorting = savedView.view.sorting[0] ?? {
    id: "system",
    desc: false,
  };
  const onViewChange = (change: WatchlistViewChange) =>
    savedView.setView((current) => ({
      ...current,
      filters: {
        ...current.filters,
        ...(change.filters
          ? Object.fromEntries(
              Object.entries(change.filters).map(([key, value]) => [
                key,
                value,
              ]),
            )
          : {}),
        ...(change.protectedFactionId !== undefined
          ? {
              protectedFactionId:
                change.protectedFactionId === null
                  ? ""
                  : String(change.protectedFactionId),
            }
          : {}),
      },
      sorting: [
        {
          id: change.sortField ?? current.sorting[0]?.id ?? "system",
          desc: change.sortDescending ?? current.sorting[0]?.desc ?? false,
        },
      ],
    }));
  const changeScope = (next: WatchlistScope) => {
    savedView.setView((current) => ({
      ...current,
      variant: next,
      filters: {},
      sorting: [{ id: "system", desc: false }],
    }));
    setViewGeneration((value) => value + 1);
  };
  const commonViewProps: WatchlistViewProps = {
    viewFilters: filters,
    viewSortField: sorting.id,
    viewSortDescending: sorting.desc,
    viewProtectedFactionId:
      Number(viewFilterString(savedView.view.filters.protectedFactionId)) ||
      null,
    onViewChange,
  };
  return (
    <>
      <PageViewRegistration
        controller={{
          reset: () => {
            savedView.reset();
            setViewGeneration((value) => value + 1);
          },
          refresh: () =>
            queryClient.invalidateQueries({
              predicate: (query) =>
                String(query.queryKey[0]).startsWith("system-watchlist"),
            }),
        }}
      />
      <div className="watchlist-view-bar">
        <nav
          className="surface watchlist-scope-tabs"
          role="tablist"
          aria-label="BGS watchlist scope"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === "personal"}
            onClick={() => changeScope("personal")}
          >
            Personal watchlist
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "global"}
            onClick={() => changeScope("global")}
          >
            Global watchlist
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "protected"}
            onClick={() => changeScope("protected")}
          >
            Protected factions watchlist
          </button>
        </nav>
        <SavedViewsControl
          model={savedView}
          onViewApplied={() => setViewGeneration((value) => value + 1)}
        />
      </div>
      <div hidden={scope !== "personal"} role="tabpanel">
        <PersonalSystemWatchlist
          key={`personal-${viewGeneration}`}
          active={scope === "personal"}
          tenantFactionName={tenantFactionName}
          canManageTenantRules={canManageTenantRules}
          canRunBgsAi={canRunBgsAi}
          {...commonViewProps}
        />
      </div>
      <div hidden={scope !== "global"} role="tabpanel">
        <GlobalSystemWatchlist
          key={`global-${viewGeneration}`}
          active={scope === "global"}
          tenantFactionName={tenantFactionName}
          canManageTenantRules={canManageTenantRules}
          canRunBgsAi={canRunBgsAi}
          {...commonViewProps}
        />
      </div>
      <div hidden={scope !== "protected"} role="tabpanel">
        <ProtectedFactionsSystemWatchlist
          key={`protected-${viewGeneration}`}
          active={scope === "protected"}
          tenantFactionName={tenantFactionName}
          canManageTenantRules={canManageTenantRules}
          canRunBgsAi={canRunBgsAi}
          {...commonViewProps}
        />
      </div>
    </>
  );
}

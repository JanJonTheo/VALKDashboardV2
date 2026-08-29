"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  ListCollapse,
  ListTree,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { DashboardSession } from "@/lib/access";
import {
  colonisationCommanderGroups,
  colonisationCommodityGroups,
  filterColonisationContributionGroups,
  filterColonisationConstructions,
  type ColonisationConstruction,
  type ColonisationContributionGroup,
} from "@/lib/colonisation";
import {
  periodOptions,
  type FeatureFilter,
  type FeatureSpec,
} from "@/lib/features";
import {
  leaderboardMetricOptions,
  type LeaderboardMetric,
  type ViewPreference,
} from "@/lib/preferences";
import { useViewPreference } from "@/lib/use-view-preference";
import { formatValue } from "@/lib/utils";
import { FeatureChart } from "./chart";
import { CopyTextButton } from "./copy-text-button";
import {
  ColonisationCommanderProgressChart,
  ColonisationCommodityGroupedTable,
  ColonisationContributionsChart,
  ColonisationContributionsTable,
  ColonisationGroupedTable,
  ColonisationProgressChart,
  colonisationCommanderGroupKey,
  colonisationCommodityGroupKey,
} from "./colonisation-progress";

interface Payload {
  data: Record<string, unknown>[];
  metrics: Record<string, string | number>;
  generated_at: string;
  pagination?: { page: number; page_size: number; total: number };
  meta?: {
    months?: string[];
    constructions?: ColonisationConstruction[];
    contributionGroups?: ColonisationContributionGroup[];
  };
}

async function getFeature(key: string, params: string): Promise<Payload> {
  const query = new URLSearchParams(params);
  if (key === "data-explorer") {
    if (!query.has("page")) query.set("page", "1");
    if (!query.has("page_size")) query.set("page_size", "25");
    if (!query.has("sort")) query.set("sort", "timestamp");
    if (!query.has("direction")) query.set("direction", "desc");
  }
  const response = await fetch(`/api/bff/${key}?${query}`, {
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(
      (await response.json().catch(() => null))?.error?.message ??
        "Dashboard data is unavailable",
    );
  }
  return response.json();
}

const objectiveSchema = z.object({
  title: z.string().min(3, "Enter an objective name"),
  system: z.string().min(2, "Enter a system"),
  target: z.number().positive("Target must be positive"),
  due: z.string().min(1, "Choose a due date"),
  notes: z.string().max(500).optional(),
});
type ObjectiveInput = z.infer<typeof objectiveSchema>;

function monthLabel(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value ?? "Month";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function filterValue(filter: FeatureFilter, params: URLSearchParams) {
  return params.get(filter.key) ?? filter.defaultValue ?? "";
}

function filterLabel(filter: FeatureFilter, value: string) {
  return (
    (filter.options?.find((option) => option.value === value)?.label ??
      value) ||
    "Any"
  );
}

export function FeatureDashboard({
  spec,
  session,
}: {
  spec: FeatureSpec;
  session: DashboardSession;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = searchParams.get("q") ?? "";
  const savedView = useViewPreference(spec, searchParams);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [collapsedConstructionIds, setCollapsedConstructionIds] = useState<
    Set<string>
  >(() => new Set());
  const [collapsedCommanderIds, setCollapsedCommanderIds] = useState<
    Set<string>
  >(() => new Set());
  const [collapsedCommodityIds, setCollapsedCommodityIds] = useState<
    Set<string>
  >(() => new Set());
  const params = savedView.effectiveParams.toString();
  const drawerFilters = spec.filters.filter(
    (filter) => filter.placement !== "page",
  );
  const activeFilters = drawerFilters.filter((filter) => {
    const value = savedView.view.filters[filter.key]?.trim();
    return Boolean(value) && value !== filter.defaultValue;
  });
  const canLoad =
    spec.key !== "systems" ||
    spec.filters.some((filter) =>
      Boolean(savedView.effectiveParams.get(filter.key)?.trim()),
    );
  const queryState = useQuery({
    queryKey: ["feature", spec.key, params],
    queryFn: () => getFeature(spec.key, params),
    refetchInterval: spec.refreshMs,
    refetchIntervalInBackground: false,
    enabled: canLoad,
  });

  useEffect(() => {
    const listener = () =>
      queryClient.invalidateQueries({ queryKey: ["feature", spec.key] });
    window.addEventListener("valk:refresh", listener);
    return () => window.removeEventListener("valk:refresh", listener);
  }, [queryClient, spec.key]);

  const effectiveSpec = useMemo<FeatureSpec>(() => {
    if (spec.key === "leaderboard") {
      const metric =
        leaderboardMetricOptions.find(
          (option) => option.value === savedView.view.metric,
        ) ?? leaderboardMetricOptions[0];
      return {
        ...spec,
        chart: {
          title: `${metric.label} by commander`,
          category: "cmdr",
          series: [{ key: metric.value, label: metric.label }],
        },
      };
    }
    if (spec.key !== "monthly-performance") return spec;
    const months = queryState.data?.meta?.months ?? [];
    const labels = [
      monthLabel(months[0]),
      monthLabel(months[1]),
      monthLabel(months[2]),
    ];
    return {
      ...spec,
      columns: spec.columns.map((column) =>
        column.key.startsWith("month")
          ? {
              ...column,
              label: labels[Number(column.key.slice(-1)) - 1] ?? column.label,
            }
          : column,
      ),
      chart: spec.chart
        ? {
            ...spec.chart,
            series: spec.chart.series.map((series) => ({
              ...series,
              label: labels[Number(series.key.slice(-1)) - 1] ?? series.label,
            })),
          }
        : undefined,
    };
  }, [queryState.data?.meta?.months, savedView.view.metric, spec]);

  const rows = useMemo(() => {
    let all = queryState.data?.data ?? [];
    for (const filter of spec.filters) {
      if (!filter.field) continue;
      const value = savedView.view.filters[filter.key]?.trim().toLowerCase();
      if (!value) continue;
      all = all.filter((row) =>
        String(row[filter.field!] ?? "")
          .toLowerCase()
          .includes(value),
      );
    }
    if (spec.key === "evaluations" && savedView.view.variant === "top5") {
      all = [...all]
        .sort((a, b) => Number(b.missions ?? 0) - Number(a.missions ?? 0))
        .slice(0, 5);
    }
    if (!query.trim()) return all;
    const needle = query.toLowerCase();
    return all.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(needle),
      ),
    );
  }, [
    queryState.data,
    query,
    savedView.view.filters,
    savedView.view.variant,
    spec.filters,
    spec.key,
  ]);
  const isColonisationView = spec.key === "colonisation";
  const colonisationVariant =
    savedView.view.variant === "constructions"
      ? "constructions"
      : savedView.view.variant === "commodities"
        ? "commodities"
        : "contributions";
  const isConstructionCommanderView =
    isColonisationView && colonisationVariant === "constructions";
  const isConstructionCommodityView =
    isColonisationView && colonisationVariant === "commodities";
  const isConstructionView =
    isConstructionCommanderView || isConstructionCommodityView;
  const isContributionView =
    isColonisationView && colonisationVariant === "contributions";
  const constructions = useMemo(
    () =>
      filterColonisationConstructions(
        queryState.data?.meta?.constructions ?? [],
        query,
      ),
    [queryState.data?.meta?.constructions, query],
  );
  const contributionGroups = useMemo(
    () =>
      filterColonisationContributionGroups(
        queryState.data?.meta?.contributionGroups ?? [],
        query,
      ),
    [queryState.data?.meta?.contributionGroups, query],
  );

  const toggleCollapsedValue = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const collapseAllColonisationGroups = () => {
    setCollapsedConstructionIds(
      new Set(constructions.map((construction) => construction.id)),
    );
    setCollapsedCommanderIds(
      new Set(
        constructions.flatMap((construction) =>
          colonisationCommanderGroups(construction).map((group) =>
            colonisationCommanderGroupKey(construction.id, group.cmdr),
          ),
        ),
      ),
    );
    setCollapsedCommodityIds(
      new Set(
        constructions.flatMap((construction) =>
          colonisationCommodityGroups(construction).map((group) =>
            colonisationCommodityGroupKey(construction.id, group.commodity.key),
          ),
        ),
      ),
    );
  };
  const expandAllColonisationGroups = () => {
    setCollapsedConstructionIds(new Set());
    setCollapsedCommanderIds(new Set());
    setCollapsedCommodityIds(new Set());
  };

  const columns = useMemo<LegacyColumnDef<Record<string, unknown>>[]>(
    () =>
      effectiveSpec.columns.map((column) => ({
        accessorKey: column.key,
        header: column.label,
        cell: (info) => formatValue(info.getValue()),
      })),
    [effectiveSpec.columns],
  );
  const table = useLegacyTable({
    data: rows,
    columns,
    state: {
      sorting: savedView.view.sorting,
      columnVisibility: Object.fromEntries(
        effectiveSpec.columns.map((column) => [
          column.key,
          savedView.view.visibleColumns.includes(column.key),
        ]),
      ),
    },
    onSortingChange: (updater) =>
      savedView.setView((current) => ({
        ...current,
        sorting:
          typeof updater === "function" ? updater(current.sorting) : updater,
      })),
    onColumnVisibilityChange: (updater) =>
      savedView.setView((current) => {
        const existing = Object.fromEntries(
          effectiveSpec.columns.map((column) => [
            column.key,
            current.visibleColumns.includes(column.key),
          ]),
        );
        const visibility =
          typeof updater === "function" ? updater(existing) : updater;
        return {
          ...current,
          visibleColumns: effectiveSpec.columns
            .filter((column) => visibility[column.key] !== false)
            .map((column) => column.key),
        };
      }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const replaceParams = (next: URLSearchParams) => {
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, {
      scroll: false,
    });
  };
  const setUrlQuery = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    replaceParams(next);
  };
  const setVariant = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    next.delete("page");
    replaceParams(next);
    savedView.setView((current) => ({ ...current, variant: value }));
  };
  const applyFilters = (values: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const filter of spec.filters) {
      const value = values[filter.key]?.trim() ?? "";
      if (!value || value === filter.defaultValue) next.delete(filter.key);
      else next.set(filter.key, value);
    }
    next.delete("page");
    replaceParams(next);
    savedView.setView((current) => ({
      ...current,
      period:
        spec.filters.some((filter) => filter.key === "period") && values.period
          ? values.period
          : current.period,
      filters: { ...current.filters, ...values },
    }));
    setFiltersOpen(false);
  };
  const clearFilter = (filter: FeatureFilter) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(filter.key);
    next.delete("page");
    replaceParams(next);
    savedView.setView((current) => ({
      ...current,
      filters: { ...current.filters, [filter.key]: "" },
    }));
  };
  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    replaceParams(next);
  };

  const mutation = useMutation({
    mutationFn: async (payload: { action: string; [key: string]: unknown }) => {
      const response = await fetch(`/api/bff/${spec.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Action failed");
      return response.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["feature", spec.key] }),
  });

  if (spec.capability && !session.capabilities.includes(spec.capability)) {
    return <AccessDenied />;
  }

  const page = queryState.data?.pagination?.page ?? 1;
  const pageSize =
    queryState.data?.pagination?.page_size ?? savedView.view.pageSize;
  const total = queryState.data?.pagination?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        spec={effectiveSpec}
        generatedAt={queryState.data?.generated_at}
        onRefresh={() => queryState.refetch()}
        refreshing={queryState.isFetching}
      />
      {spec.key === "leaderboard" && (
        <LeaderboardControls
          period={savedView.view.period ?? "cm"}
          metric={savedView.view.metric ?? "missions"}
          filters={savedView.view.filters}
          onChange={(change) => {
            savedView.setView((current) => ({
              ...current,
              ...change,
              filters: change.filters ?? current.filters,
            }));
            const next = new URLSearchParams(searchParams.toString());
            if (change.period) next.set("period", change.period);
            if (change.metric) next.set("metric", change.metric);
            if (change.filters) {
              for (const [key, value] of Object.entries(change.filters)) {
                if (value) next.set(key, value);
                else next.delete(key);
              }
            }
            next.delete("page");
            replaceParams(next);
          }}
          onReset={async () => {
            await savedView.reset();
            const next = new URLSearchParams(searchParams.toString());
            for (const key of [
              "period",
              "metric",
              "from_date",
              "to_date",
              "from_month",
              "to_month",
              "system_name",
              "page_size",
            ])
              next.delete(key);
            replaceParams(next);
          }}
        />
      )}
      <VariantTabs
        spec={spec}
        current={
          isColonisationView ? colonisationVariant : savedView.view.variant
        }
        onChange={setVariant}
      />
      <div className="metric-strip">
        {effectiveSpec.metrics.map((metric) => {
          const selectedKey = savedView.view.metric ?? "missions";
          const selectedValues = rows.map(
            (row) => Number(row[selectedKey]) || 0,
          );
          const selectedTotal = selectedValues.reduce(
            (total, value) => total + value,
            0,
          );
          const derived =
            spec.key === "leaderboard"
              ? {
                  commanders: new Set(
                    rows.map((row) => String(row.cmdr ?? "")).filter(Boolean),
                  ).size,
                  selectedTotal,
                  selectedAverage: rows.length
                    ? selectedTotal / rows.length
                    : 0,
                  selectedTop: Math.max(0, ...selectedValues),
                }
              : {};
          const value =
            metric.key in derived
              ? derived[metric.key as keyof typeof derived]
              : queryState.data?.metrics[metric.key];
          return (
            <article key={metric.key}>
              <span>{metric.label}</span>
              <strong>
                {queryState.isLoading ? "…" : formatValue(value)}
                {value !== undefined && value !== null ? metric.suffix : ""}
              </strong>
              <small>Current selection</small>
            </article>
          );
        })}
      </div>
      {queryState.isError && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not update this view</strong>
            <span>{queryState.error.message}</span>
          </div>
          <button onClick={() => queryState.refetch()}>Retry</button>
        </div>
      )}
      {!canLoad && spec.key === "systems" && (
        <div className="surface query-guidance">
          <Search size={20} />
          <div>
            <strong>Search the EDDN system database</strong>
            <span>
              Open Filters and enter an exact system name or at least one
              faction, state, population, conflict or powerplay filter.
            </span>
          </div>
          <button
            className="primary-button"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter size={15} />
            Open filters
          </button>
        </div>
      )}
      {effectiveSpec.chart &&
        canLoad &&
        (isConstructionView
          ? constructions.length > 0
          : isContributionView
            ? contributionGroups.length > 0
            : rows.length > 0) && (
          <section className="surface chart-surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">VISUAL ANALYSIS</p>
                <h2>
                  {isConstructionView
                    ? isConstructionCommanderView
                      ? "Construction commander progress"
                      : "Construction commodity progress"
                    : isContributionView
                      ? "Commander commodity contributions"
                      : effectiveSpec.chart.title}
                </h2>
              </div>
              <span className="table-alternative">
                The data table below is the accessible chart alternative.
              </span>
            </div>
            {isConstructionView ? (
              isConstructionCommanderView ? (
                <ColonisationCommanderProgressChart
                  constructions={constructions}
                />
              ) : (
                <ColonisationProgressChart constructions={constructions} />
              )
            ) : isContributionView ? (
              <ColonisationContributionsChart groups={contributionGroups} />
            ) : (
              <FeatureChart spec={effectiveSpec} rows={rows} />
            )}
          </section>
        )}
      <section className="surface data-surface">
        <div className="data-toolbar">
          <div>
            <p className="eyebrow">DETAILS</p>
            <h2>{effectiveSpec.title} data</h2>
          </div>
          <div className="toolbar-actions">
            <label className="search-box">
              <Search size={15} />
              <span className="sr-only">Search loaded rows</span>
              <input
                value={query}
                onChange={(event) => setUrlQuery(event.target.value)}
                placeholder="Search loaded rows…"
              />
            </label>
            {drawerFilters.length > 0 && (
              <button
                className="secondary-button filter-button"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter size={15} />
                Filters
                {activeFilters.length > 0 && (
                  <span className="filter-count">{activeFilters.length}</span>
                )}
              </button>
            )}
            <FeatureActions
              spec={spec}
              session={session}
              mutation={mutation}
              rows={rows}
              openObjective={() => setObjectiveOpen(true)}
            />
            {!isColonisationView && <ColumnChooser table={table} />}
            {isConstructionView && (
              <>
                <button
                  className="secondary-button"
                  onClick={collapseAllColonisationGroups}
                >
                  <ListCollapse size={15} />
                  Collapse All
                </button>
                <button
                  className="secondary-button"
                  onClick={expandAllColonisationGroups}
                >
                  <ListTree size={15} />
                  Expand All
                </button>
              </>
            )}
            {spec.key !== "leaderboard" && (
              <button
                className="secondary-button"
                onClick={() => {
                  expandAllColonisationGroups();
                  void savedView.reset();
                }}
              >
                <RotateCcw size={15} />
                Reset view
              </button>
            )}
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="active-filters">
            {activeFilters.map((filter) => {
              const value =
                savedView.view.filters[filter.key] ?? filter.defaultValue ?? "";
              return (
                <button
                  key={filter.key}
                  onClick={() => clearFilter(filter)}
                  aria-label={`Reset ${filter.label} filter`}
                >
                  {filter.label}: <strong>{filterLabel(filter, value)}</strong>
                  <X size={12} />
                </button>
              );
            })}
          </div>
        )}
        {canLoad &&
          !queryState.isLoading &&
          (isConstructionView
            ? constructions.length === 0
            : isContributionView
              ? contributionGroups.length === 0
              : rows.length === 0) &&
          !queryState.isError && (
            <p className="inline-empty">
              No records match the current API and table filters.
            </p>
          )}
        {isConstructionCommanderView ? (
          <ColonisationGroupedTable
            constructions={constructions}
            collapsedConstructionIds={collapsedConstructionIds}
            collapsedCommanderIds={collapsedCommanderIds}
            onToggleConstruction={(constructionId) =>
              toggleCollapsedValue(setCollapsedConstructionIds, constructionId)
            }
            onToggleCommander={(constructionId, cmdr) =>
              toggleCollapsedValue(
                setCollapsedCommanderIds,
                colonisationCommanderGroupKey(constructionId, cmdr),
              )
            }
          />
        ) : isConstructionCommodityView ? (
          <ColonisationCommodityGroupedTable
            constructions={constructions}
            collapsedConstructionIds={collapsedConstructionIds}
            collapsedCommodityIds={collapsedCommodityIds}
            onToggleConstruction={(constructionId) =>
              toggleCollapsedValue(setCollapsedConstructionIds, constructionId)
            }
            onToggleCommodity={(constructionId, commodityKey) =>
              toggleCollapsedValue(
                setCollapsedCommodityIds,
                colonisationCommodityGroupKey(constructionId, commodityKey),
              )
            }
          />
        ) : isContributionView ? (
          <ColonisationContributionsTable groups={contributionGroups} />
        ) : (
          <>
            <div className="desktop-table">
              <table>
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th key={header.id}>
                          <button
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            <ChevronUp size={12} />
                          </button>
                        </th>
                      ))}
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                      <td>
                        <button
                          className="row-menu"
                          aria-label="View row details"
                          onClick={() => setSelected(row.original)}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {rows.map((row, index) => (
                <button
                  className="data-card"
                  key={index}
                  onClick={() => setSelected(row)}
                >
                  <div>
                    <strong>
                      {formatValue(
                        row[
                          effectiveSpec.columns.find(
                            (column) => column.priority,
                          )?.key ?? effectiveSpec.columns[0].key
                        ],
                      )}
                    </strong>
                    <span>
                      {formatValue(row[effectiveSpec.columns[1]?.key])}
                    </span>
                  </div>
                  <dl>
                    {effectiveSpec.columns.slice(2, 5).map((column) => (
                      <div key={column.key}>
                        <dt>{column.label}</dt>
                        <dd>{formatValue(row[column.key])}</dd>
                      </div>
                    ))}
                  </dl>
                </button>
              ))}
            </div>
          </>
        )}
        <footer
          className={`table-footer${isColonisationView ? " colonisation-table-footer" : ""}`}
        >
          <span>
            {isConstructionView
              ? isConstructionCommanderView
                ? `${constructions.length} constructions · ${constructions.reduce((count, construction) => count + colonisationCommanderGroups(construction).length, 0)} commander groups · ${constructions.reduce((count, construction) => count + construction.commodities.length, 0)} commodities`
                : `${constructions.length} constructions · ${constructions.reduce((count, construction) => count + construction.commodities.length, 0)} commodity groups · ${constructions.reduce((count, construction) => count + colonisationCommodityGroups(construction).reduce((contributionCount, group) => contributionCount + group.contributions.length, 0), 0)} Cmdr contributions`
              : isContributionView
                ? `${contributionGroups.length} commanders · ${contributionGroups.reduce((count, group) => count + group.constructions.length, 0)} constructions · ${contributionGroups.reduce((count, group) => count + group.constructions.reduce((commodityCount, construction) => commodityCount + construction.commodities.length, 0), 0)} commodity groups`
                : `Showing ${rows.length} of ${total} rows`}
          </span>
          {!isColonisationView && (
            <label className="page-size-select">
              <span>Rows per page</span>
              <select
                value={savedView.view.pageSize}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  savedView.setView((current) => ({
                    ...current,
                    pageSize: value,
                  }));
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("page_size", String(value));
                  next.delete("page");
                  replaceParams(next);
                }}
              >
                {[10, 25, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isColonisationView && (
            <div>
              <button
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <b>
                {page} / {totalPages}
              </b>
              <button
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </footer>
      </section>
      {filtersOpen && (
        <FilterSheet
          open
          onOpenChange={setFiltersOpen}
          filters={drawerFilters}
          params={savedView.effectiveParams}
          onApply={applyFilters}
        />
      )}
      <DetailSheet
        row={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
      <ObjectiveDialog
        open={objectiveOpen}
        onOpenChange={setObjectiveOpen}
        onSubmit={(values) =>
          mutation.mutate(
            { action: "create", ...values },
            { onSuccess: () => setObjectiveOpen(false) },
          )
        }
      />
      {mutation.isSuccess && (
        <div className="toast" role="status">
          Action completed successfully.
        </div>
      )}
    </>
  );
}

function LeaderboardControls({
  period,
  metric,
  filters,
  onChange,
  onReset,
}: {
  period: string;
  metric: LeaderboardMetric;
  filters: Record<string, string>;
  onChange: (change: Partial<ViewPreference>) => void;
  onReset: () => void | Promise<void>;
}) {
  const changeFilter = (key: string, value: string) =>
    onChange({ filters: { ...filters, [key]: value } });
  return (
    <section
      className="surface leaderboard-controls"
      aria-label="Leaderboard view settings"
    >
      <div className="leaderboard-control-grid">
        <label>
          <span>Period</span>
          <select
            value={period}
            onChange={(event) => onChange({ period: event.target.value })}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Metric</span>
          <select
            value={metric}
            onChange={(event) =>
              onChange({
                metric: event.target.value as LeaderboardMetric,
                sorting: [{ id: event.target.value, desc: true }],
              })
            }
          >
            {leaderboardMetricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {period === "date-range" && (
          <>
            <label>
              <span>From date</span>
              <input
                type="date"
                value={filters.from_date ?? ""}
                onChange={(event) =>
                  changeFilter("from_date", event.target.value)
                }
              />
            </label>
            <label>
              <span>To date</span>
              <input
                type="date"
                value={filters.to_date ?? ""}
                onChange={(event) =>
                  changeFilter("to_date", event.target.value)
                }
              />
            </label>
          </>
        )}
        {period === "month-range" && (
          <>
            <label>
              <span>From month</span>
              <input
                type="month"
                value={filters.from_month ?? ""}
                onChange={(event) =>
                  changeFilter("from_month", event.target.value)
                }
              />
            </label>
            <label>
              <span>To month</span>
              <input
                type="month"
                value={filters.to_month ?? ""}
                onChange={(event) =>
                  changeFilter("to_month", event.target.value)
                }
              />
            </label>
          </>
        )}
      </div>
      <button className="secondary-button" onClick={() => void onReset()}>
        <RotateCcw size={15} />
        Reset view
      </button>
    </section>
  );
}

function ColumnChooser({
  table,
}: {
  table: {
    getAllLeafColumns: () => Array<{
      id: string;
      getCanHide: () => boolean;
      getIsVisible: () => boolean;
      getToggleVisibilityHandler: () => (event: unknown) => void;
    }>;
  };
}) {
  return (
    <details className="column-chooser">
      <summary className="secondary-button">
        <Settings2 size={15} />
        Columns
      </summary>
      <div>
        {table
          .getAllLeafColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <label key={column.id}>
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              <span>{column.id.replace(/([A-Z])/g, " $1")}</span>
            </label>
          ))}
      </div>
    </details>
  );
}

function PageHeader({
  spec,
  generatedAt,
  onRefresh,
  refreshing,
}: {
  spec: FeatureSpec;
  generatedAt?: string;
  onRefresh: () => unknown;
  refreshing: boolean;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{spec.eyebrow}</p>
        <h1>{spec.title}</h1>
        <p>{spec.description}</p>
      </div>
      <div>
        <span className="live-status">
          <i />
          Live data
        </span>
        <button className="secondary-button" onClick={onRefresh}>
          <RefreshCw className={refreshing ? "spin" : ""} size={15} />
          Refresh
        </button>
        <small>
          {generatedAt
            ? `Updated ${new Date(generatedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Waiting for a query…"}
        </small>
      </div>
    </header>
  );
}

function VariantTabs({
  spec,
  current,
  onChange,
}: {
  spec: FeatureSpec;
  current?: string;
  onChange: (key: string, value: string) => void;
}) {
  const variants =
    spec.key === "evaluations"
      ? {
          key: "mode",
          current: current ?? "full",
          items: [
            ["full", "Full"],
            ["top5", "Top 5 by missions"],
          ],
        }
      : spec.key === "colonisation"
        ? {
            key: "view",
            current: current ?? "contributions",
            items: [
              ["contributions", "Contributions"],
              ["constructions", "Construction/Cmdrs"],
              ["commodities", "Construction/Commodities"],
            ],
          }
        : spec.key === "cz-summary"
          ? {
              key: "type",
              current: current ?? "space",
              items: [
                ["space", "Space CZ"],
                ["ground", "Ground CZ"],
              ],
            }
          : null;
  if (!variants) return null;
  return (
    <div className="variant-tabs" aria-label={`${spec.title} view`}>
      {variants.items.map(([value, label]) => (
        <button
          className={variants.current === value ? "active" : ""}
          onClick={() => onChange(variants.key, value)}
          key={value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FeatureActions({
  spec,
  session,
  mutation,
  rows,
  openObjective,
}: {
  spec: FeatureSpec;
  session: DashboardSession;
  mutation: {
    mutate: (payload: { action: string; [key: string]: unknown }) => void;
    isPending: boolean;
  };
  rows: Record<string, unknown>[];
  openObjective: () => void;
}) {
  return (
    <>
      {spec.actions?.includes("create-objective") &&
        session.capabilities.includes("objectives:write") && (
          <button className="primary-button" onClick={openObjective}>
            <Plus size={15} />
            New objective
          </button>
        )}
      {spec.actions?.includes("discord-report") &&
        session.capabilities.includes("reports:send") && (
          <button
            className="primary-button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ action: "discord-report" })}
          >
            <Bot size={15} />
            Send report
          </button>
        )}
      {spec.actions?.includes("ai-assessment") &&
        session.capabilities.includes("assessment:run") && (
          <button
            className="primary-button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ action: "ai-assessment", monthly_data: rows })
            }
          >
            <Sparkles size={15} />
            AI assessment
          </button>
        )}
    </>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  params,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FeatureFilter[];
  params: URLSearchParams;
  onApply: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      filters.map((filter) => [filter.key, filterValue(filter, params)]),
    ),
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Filter this view</Dialog.Title>
              <Dialog.Description>
                Applied filters are stored in the URL and forwarded only to
                supported API parameters.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close filters">
              <X size={19} />
            </Dialog.Close>
          </div>
          <form
            className="filter-form"
            onSubmit={(event) => {
              event.preventDefault();
              onApply(values);
            }}
          >
            {filters.map((filter) => (
              <label key={filter.key}>
                <span>{filter.label}</span>
                {filter.type === "select" ? (
                  <select
                    value={values[filter.key] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [filter.key]: event.target.value,
                      }))
                    }
                  >
                    {filter.options?.map((option) => (
                      <option value={option.value} key={option.value || "any"}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={filter.type === "number" ? "number" : "text"}
                    value={values[filter.key] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [filter.key]: event.target.value,
                      }))
                    }
                    placeholder={
                      filter.placeholder ?? `Any ${filter.label.toLowerCase()}`
                    }
                  />
                )}
              </label>
            ))}
            <footer>
              <Dialog.Close className="secondary-button" type="button">
                Cancel
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

function DetailSheet({
  row,
  onOpenChange,
}: {
  row: Record<string, unknown> | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={Boolean(row)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content system-detail-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Record detail</Dialog.Title>
              <Dialog.Description>
                Complete normalized server response.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close details">
              <X size={19} />
            </Dialog.Close>
          </div>
          {row && (
            <>
              <dl className="detail-list">
                {Object.entries(row)
                  .filter(
                    ([, value]) =>
                      !Array.isArray(value) && typeof value !== "object",
                  )
                  .slice(0, 10)
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd
                        className={
                          [
                            "system",
                            "system_name",
                            "requested_system",
                          ].includes(key.toLocaleLowerCase("en"))
                            ? "copyable-value"
                            : undefined
                        }
                      >
                        <span>{formatValue(value)}</span>
                        {["system", "system_name", "requested_system"].includes(
                          key.toLocaleLowerCase("en"),
                        ) && typeof value === "string" ? (
                          <CopyTextButton
                            value={value}
                            label="Copy system name"
                          />
                        ) : null}
                      </dd>
                    </div>
                  ))}
              </dl>
              {Array.isArray(row.factions) && (
                <SystemDetails
                  factions={row.factions as Record<string, unknown>[]}
                  conflicts={(row.conflicts as Record<string, unknown>[]) ?? []}
                  powerplays={
                    (row.powerplays as Record<string, unknown>[]) ?? []
                  }
                />
              )}
              <div className="json-block">
                <div>
                  <span>Normalized JSON</span>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        JSON.stringify(row, null, 2),
                      )
                    }
                  >
                    Copy
                  </button>
                </div>
                <pre>{JSON.stringify(row, null, 2)}</pre>
              </div>
            </>
          )}
          <footer>
            <Dialog.Close className="primary-button">Done</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SystemDetails({
  factions,
  conflicts,
  powerplays,
}: {
  factions: Record<string, unknown>[];
  conflicts: Record<string, unknown>[];
  powerplays: Record<string, unknown>[];
}) {
  return (
    <div className="system-details">
      <section>
        <h3>Minor factions</h3>
        {factions.length ? (
          <div className="system-detail-rows">
            {[...factions]
              .sort(
                (a, b) => Number(b.influence ?? 0) - Number(a.influence ?? 0),
              )
              .map((faction, index) => (
                <div key={String(faction.id ?? faction.name ?? index)}>
                  <strong>{formatValue(faction.name)}</strong>
                  <span>{formatValue(faction.state)}</span>
                  <b>{(Number(faction.influence ?? 0) * 100).toFixed(2)}%</b>
                </div>
              ))}
          </div>
        ) : (
          <p>No factions reported.</p>
        )}
      </section>
      <section>
        <h3>Conflicts</h3>
        {conflicts.length ? (
          <div className="system-detail-rows">
            {conflicts.map((conflict, index) => (
              <div key={String(conflict.id ?? index)}>
                <strong>
                  {formatValue(conflict.faction1)} vs.{" "}
                  {formatValue(conflict.faction2)}
                </strong>
                <span>{formatValue(conflict.war_type)}</span>
                <b>
                  {formatValue(conflict.won_days1)}–
                  {formatValue(conflict.won_days2)}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p>No active conflicts reported.</p>
        )}
      </section>
      <section>
        <h3>Powerplay</h3>
        {powerplays.length ? (
          <div className="system-detail-rows">
            {powerplays.map((powerplay, index) => (
              <div key={String(powerplay.id ?? index)}>
                <strong>{formatValue(powerplay.power)}</strong>
                <span>{formatValue(powerplay.powerplay_state)}</span>
                <b>{formatValue(powerplay.control_progress)}</b>
              </div>
            ))}
          </div>
        ) : (
          <p>No powerplay record reported.</p>
        )}
      </section>
    </div>
  );
}

function ObjectiveDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ObjectiveInput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ObjectiveInput>({ resolver: zodResolver(objectiveSchema) });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Create objective</Dialog.Title>
              <Dialog.Description>
                Add an operational target. This action is written to the audit
                log.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close">
              <X size={19} />
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="objective-form">
            <label>
              <span>Objective</span>
              <input {...register("title")} placeholder="e.g. Hold HIP 10792" />
              {errors.title && <small>{errors.title.message}</small>}
            </label>
            <label>
              <span>System</span>
              <input {...register("system")} placeholder="System name" />
              {errors.system && <small>{errors.system.message}</small>}
            </label>
            <div>
              <label>
                <span>Target</span>
                <input
                  type="number"
                  {...register("target", { valueAsNumber: true })}
                  placeholder="100"
                />
              </label>
              <label>
                <span>Due</span>
                <input type="date" {...register("due")} />
              </label>
            </div>
            <label>
              <span>Notes</span>
              <textarea {...register("notes")} rows={4} />
            </label>
            <footer>
              <Dialog.Close type="button" className="secondary-button">
                Cancel
              </Dialog.Close>
              <button type="submit" className="primary-button">
                Create objective
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccessDenied() {
  return (
    <div className="empty-state">
      <div className="empty-icon">V</div>
      <p className="eyebrow">RESTRICTED</p>
      <h1>Administrator access required</h1>
      <p>Your dashboard account does not grant access to this area.</p>
    </div>
  );
}

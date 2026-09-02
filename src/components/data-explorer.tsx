"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardCopy,
  Copy,
  Database,
  Download,
  FileJson,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildEventFilters,
  collectExplorerFilterOptions,
  DATA_EXPLORER_TABLES,
  dataExplorerTableLabel,
  explorerJsonText,
  explorerRowId,
  orderExplorerColumns,
  parseExplorerJson,
  rowMatchesExplorerSearch,
  rowsToClipboard,
  rowsToCsv,
  type DataExplorerFilterOptions,
  type DataExplorerRow,
  type DataExplorerTable,
  type EventFilterState,
} from "@/lib/data-explorer";
import styles from "./data-explorer.module.css";
import { PageViewRegistration } from "./page-view-context";
import { SavedViewsControl } from "./saved-views-control";
import { viewFilterString, type ViewPreference } from "@/lib/preferences";
import { useStoredViewPreference } from "@/lib/use-view-preference";

interface ExplorerPayload {
  data: DataExplorerRow[];
  metrics: Record<string, string | number>;
  generated_at: string;
  pagination?: { page: number; page_size: number; total: number };
  meta?: {
    columns?: string[];
    filter_options?: DataExplorerFilterOptions;
  };
}

type SortDirection = "asc" | "desc";
type AllAction = "copy" | "export" | null;

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const initialEventFilters: EventFilterState = {
  cmdr: "",
  event: "",
  tickid: "",
  colonisationOnly: false,
  dateFilter: false,
  fromDate: localDate(),
  toDate: localDate(1),
};

async function fetchExplorer(
  params: URLSearchParams,
): Promise<ExplorerPayload> {
  const response = await fetch(`/api/bff/data-explorer?${params}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    ExplorerPayload | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message =
      body && "error" in body
        ? body.error?.message
        : "Data explorer is unavailable";
    throw new Error(message || "Data explorer is unavailable");
  }
  return body as ExplorerPayload;
}

function humaniseColumn(column: string): string {
  return column
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("Clipboard access was rejected by the browser");
}

function downloadCsv(
  rows: DataExplorerRow[],
  columns: string[],
  filename: string,
) {
  const blob = new Blob(["\uFEFF", rowsToCsv(rows, columns)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className={styles.jsonNull}>null</span>;
  if (typeof value === "string")
    return <span className={styles.jsonString}>{JSON.stringify(value)}</span>;
  if (typeof value === "number")
    return <span className={styles.jsonNumber}>{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className={styles.jsonBoolean}>{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function JsonNode({
  name,
  value,
  depth = 0,
}: {
  name?: string;
  value: unknown;
  depth?: number;
}) {
  const isObject = value !== null && typeof value === "object";
  if (!isObject)
    return (
      <div className={styles.jsonLeaf}>
        {name !== undefined && <span className={styles.jsonKey}>{name}:</span>}
        <JsonPrimitive value={value} />
      </div>
    );

  const entries = Object.entries(value as Record<string, unknown>);
  const isArray = Array.isArray(value);
  return (
    <details className={styles.jsonBranch} open={depth < 2}>
      <summary>
        {name !== undefined && <span className={styles.jsonKey}>{name}</span>}
        <span className={styles.jsonShape}>
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </summary>
      <div className={styles.jsonChildren}>
        {entries.map(([key, child]) => (
          <JsonNode key={key} name={key} value={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

export function DataExplorer() {
  const queryClient = useQueryClient();
  const defaults = useMemo<ViewPreference>(
    () => ({
      search: "",
      filters: {
        cmdr: "",
        event: "",
        tickid: "",
        colonisationOnly: "false",
        dateFilter: "false",
        fromDate: initialEventFilters.fromDate,
        toDate: initialEventFilters.toDate,
      },
      variant: "event",
      sorting: [{ id: "timestamp", desc: true }],
      visibleColumns: [],
      pageSize: 50,
    }),
    [],
  );
  const savedView = useStoredViewPreference("data-explorer", defaults);
  const table = DATA_EXPLORER_TABLES.includes(
    savedView.view.variant as DataExplorerTable,
  )
    ? (savedView.view.variant as DataExplorerTable)
    : "event";
  const eventFilters = useMemo<EventFilterState>(
    () => ({
      cmdr: viewFilterString(savedView.view.filters.cmdr),
      event: viewFilterString(savedView.view.filters.event),
      tickid: viewFilterString(savedView.view.filters.tickid),
      colonisationOnly:
        viewFilterString(savedView.view.filters.colonisationOnly) === "true",
      dateFilter:
        viewFilterString(savedView.view.filters.dateFilter) === "true",
      fromDate:
        viewFilterString(savedView.view.filters.fromDate) ||
        initialEventFilters.fromDate,
      toDate:
        viewFilterString(savedView.view.filters.toDate) ||
        initialEventFilters.toDate,
    }),
    [savedView.view.filters],
  );
  const search = savedView.view.search ?? "";
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = savedView.view.pageSize;
  const sortColumn =
    savedView.view.sorting[0]?.id ?? (table === "event" ? "timestamp" : "id");
  const sortDirection: SortDirection = savedView.view.sorting[0]?.desc
    ? "desc"
    : "asc";
  const [selectedRows, setSelectedRows] = useState<
    Map<string, DataExplorerRow>
  >(() => new Map());
  const [detailRow, setDetailRow] = useState<DataExplorerRow | null>(null);
  const [status, setStatus] = useState("");
  const [allAction, setAllAction] = useState<AllAction>(null);
  const setSearch = (value: string) =>
    savedView.setView((current) => ({ ...current, search: value }));
  const setPageSize = (value: number) =>
    savedView.setView((current) => ({ ...current, pageSize: value }));

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const dateRangeValid =
    !eventFilters.dateFilter ||
    !eventFilters.fromDate ||
    !eventFilters.toDate ||
    eventFilters.fromDate <= eventFilters.toDate;
  const structuredFilters = useMemo(
    () => (table === "event" ? buildEventFilters(eventFilters) : []),
    [eventFilters, table],
  );

  const makeParams = (options?: {
    requestedPage?: number;
    scopeAll?: boolean;
    optionCatalog?: boolean;
  }) => {
    const params = new URLSearchParams({
      table,
      page: String(options?.requestedPage ?? page),
      page_size: String(pageSize),
      sort: sortColumn,
      direction: sortDirection,
    });
    if (structuredFilters.length)
      params.set("filters", JSON.stringify(structuredFilters));
    if (options?.scopeAll) params.set("scope", "all");
    if (options?.optionCatalog) params.set("options", "1");
    return params;
  };

  const regularParams = makeParams().toString();
  const query = useQuery({
    queryKey: ["data-explorer", "page", regularParams],
    queryFn: () => fetchExplorer(new URLSearchParams(regularParams)),
    enabled: dateRangeValid && !debouncedSearch,
  });
  const allParams = makeParams({ requestedPage: 1, scopeAll: true }).toString();
  const allQuery = useQuery({
    queryKey: ["data-explorer", "all", allParams],
    queryFn: () => fetchExplorer(new URLSearchParams(allParams)),
    enabled: dateRangeValid && Boolean(debouncedSearch),
  });
  const optionParams = useMemo(
    () =>
      new URLSearchParams({
        table: "event",
        options: "1",
        page: "1",
        page_size: "250",
      }).toString(),
    [],
  );
  const optionsQuery = useQuery({
    queryKey: ["data-explorer", "options", table],
    queryFn: () => fetchExplorer(new URLSearchParams(optionParams)),
    enabled: table === "event",
    staleTime: 5 * 60_000,
  });

  const searchedRows = useMemo(
    () =>
      (allQuery.data?.data ?? []).filter((row) =>
        rowMatchesExplorerSearch(row, debouncedSearch),
      ),
    [allQuery.data?.data, debouncedSearch],
  );
  const displayedRows = useMemo(
    () =>
      debouncedSearch
        ? searchedRows.slice((page - 1) * pageSize, page * pageSize)
        : (query.data?.data ?? []),
    [debouncedSearch, page, pageSize, query.data?.data, searchedRows],
  );
  const total = debouncedSearch
    ? searchedRows.length
    : (query.data?.pagination?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activePayload = debouncedSearch ? allQuery.data : query.data;
  const loading = debouncedSearch ? allQuery.isFetching : query.isFetching;
  const error = debouncedSearch ? allQuery.error : query.error;

  const columns = useMemo(() => {
    const names = [
      ...(activePayload?.meta?.columns ?? []),
      ...(optionsQuery.data?.meta?.columns ?? []),
      ...displayedRows.flatMap((row) => Object.keys(row)),
    ];
    return orderExplorerColumns(names, table);
  }, [
    activePayload?.meta?.columns,
    displayedRows,
    optionsQuery.data?.meta?.columns,
    table,
  ]);

  const filterOptions = useMemo(
    () =>
      optionsQuery.data?.meta?.filter_options ??
      collectExplorerFilterOptions(optionsQuery.data?.data ?? []),
    [optionsQuery.data],
  );

  const pageRowIds = displayedRows.map((row) => explorerRowId(table, row));
  const allPageRowsSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedRows.has(id));

  const updateFilters = (change: Partial<EventFilterState>) => {
    const next = { ...eventFilters, ...change };
    savedView.setView((current) => ({
      ...current,
      filters: Object.fromEntries(
        Object.entries(next).map(([key, value]) => [key, String(value)]),
      ),
    }));
    setPage(1);
    setSelectedRows(new Map());
  };

  const changeTable = (nextTable: DataExplorerTable) => {
    savedView.setView((current) => ({
      ...current,
      search: "",
      variant: nextTable,
      sorting: [{ id: nextTable === "event" ? "timestamp" : "id", desc: true }],
    }));
    setPage(1);
    setDebouncedSearch("");
    setSelectedRows(new Map());
    setDetailRow(null);
    setStatus("");
  };

  const changeSort = (column: string) => {
    setPage(1);
    savedView.setView((current) => ({
      ...current,
      sorting: [
        {
          id: column,
          desc: sortColumn === column ? sortDirection === "asc" : false,
        },
      ],
    }));
  };

  const toggleRow = (row: DataExplorerRow) => {
    const id = explorerRowId(table, row);
    setSelectedRows((current) => {
      const next = new Map(current);
      if (next.has(id)) next.delete(id);
      else next.set(id, row);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedRows((current) => {
      const next = new Map(current);
      if (allPageRowsSelected) pageRowIds.forEach((id) => next.delete(id));
      else
        displayedRows.forEach((row) =>
          next.set(explorerRowId(table, row), row),
        );
      return next;
    });
  };

  const copyRows = async (rows: DataExplorerRow[], message: string) => {
    try {
      await writeClipboard(rowsToClipboard(rows, columns));
      setStatus(message);
    } catch (copyError) {
      setStatus(
        copyError instanceof Error
          ? copyError.message
          : "The records could not be copied",
      );
    }
  };

  const completeRows = async (): Promise<DataExplorerRow[]> => {
    const activeSearch = search.trim();
    if (!activeSearch)
      return (await fetchExplorer(new URLSearchParams(allParams))).data;
    const payload =
      allQuery.data ?? (await fetchExplorer(new URLSearchParams(allParams)));
    return payload.data.filter((row) =>
      rowMatchesExplorerSearch(row, activeSearch),
    );
  };

  const handleAll = async (action: Exclude<AllAction, null>) => {
    setAllAction(action);
    setStatus("Loading the complete filtered result…");
    try {
      const rows = await completeRows();
      if (action === "copy")
        await copyRows(rows, `${rows.length} records copied`);
      else {
        downloadCsv(
          rows,
          columns,
          `${table}-${new Date().toISOString().slice(0, 10)}.csv`,
        );
        setStatus(`${rows.length} records exported`);
      }
    } catch (actionError) {
      setStatus(
        actionError instanceof Error
          ? actionError.message
          : "The complete result could not be loaded",
      );
    } finally {
      setAllAction(null);
    }
  };

  const selected = [...selectedRows.values()];
  const detailValue = detailRow?.raw_json ?? detailRow;

  return (
    <div className={styles.explorer}>
      <PageViewRegistration
        controller={{
          reset: () => {
            savedView.reset();
            setPage(1);
            setSelectedRows(new Map());
            setDetailRow(null);
            setStatus("");
          },
          refresh: () =>
            queryClient.invalidateQueries({ queryKey: ["data-explorer"] }),
        }}
      />
      <header className={styles.header}>
        <div>
          <p>ADMIN / RAW DATA</p>
          <h1>
            <Database aria-hidden="true" /> Data explorer
          </h1>
          <span>Inspect, filter, copy and export tenant database records.</span>
        </div>
        <div className={styles.headerActions}>
          <SavedViewsControl
            model={savedView}
            onViewApplied={() => {
              setPage(1);
              setSelectedRows(new Map());
            }}
          />
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => {
              void query.refetch();
              if (debouncedSearch) void allQuery.refetch();
              if (table === "event") void optionsQuery.refetch();
            }}
            disabled={loading}
          >
            <RefreshCw className={loading ? styles.spin : ""} size={16} />
            Refresh
          </button>
        </div>
      </header>

      <section className={styles.controls} aria-label="Data explorer controls">
        <label className={styles.tableSelect}>
          <span>Table type</span>
          <select
            value={table}
            onChange={(event) =>
              changeTable(event.target.value as DataExplorerTable)
            }
          >
            {DATA_EXPLORER_TABLES.map((option) => (
              <option key={option} value={option}>
                {dataExplorerTableLabel(option)}
              </option>
            ))}
          </select>
        </label>

        {table === "event" && (
          <fieldset className={styles.filters}>
            <legend>
              <Filter size={15} aria-hidden="true" /> Event filters
            </legend>
            <div className={styles.filterGrid}>
              <label>
                <span>Cmdr</span>
                <select
                  value={eventFilters.cmdr}
                  onChange={(event) =>
                    updateFilters({ cmdr: event.target.value })
                  }
                >
                  <option value="">All commanders</option>
                  {filterOptions.cmdrs.map((cmdr) => (
                    <option key={cmdr} value={cmdr}>
                      {cmdr}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Event</span>
                <select
                  value={eventFilters.event}
                  onChange={(event) =>
                    updateFilters({ event: event.target.value })
                  }
                >
                  <option value="">All events</option>
                  {filterOptions.events.map((eventName) => (
                    <option key={eventName} value={eventName}>
                      {eventName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tick ID</span>
                <select
                  value={eventFilters.tickid}
                  onChange={(event) =>
                    updateFilters({ tickid: event.target.value })
                  }
                >
                  <option value="">All ticks</option>
                  {filterOptions.tickids.map((tickid) => (
                    <option key={tickid} value={tickid}>
                      {tickid}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.filterToggles}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={eventFilters.colonisationOnly}
                  onChange={(event) =>
                    updateFilters({ colonisationOnly: event.target.checked })
                  }
                />
                Colonisation only
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={eventFilters.dateFilter}
                  onChange={(event) =>
                    updateFilters({ dateFilter: event.target.checked })
                  }
                />
                Date filter
              </label>
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={eventFilters.fromDate}
                  disabled={!eventFilters.dateFilter}
                  onChange={(event) =>
                    updateFilters({ fromDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={eventFilters.toDate}
                  disabled={!eventFilters.dateFilter}
                  onChange={(event) =>
                    updateFilters({ toDate: event.target.value })
                  }
                />
              </label>
            </div>
            {!dateRangeValid && (
              <p className={styles.validation} role="alert">
                The “From” date must not be later than the “To” date.
              </p>
            )}
          </fieldset>
        )}

        <div className={styles.searchRow}>
          <label className={styles.searchBox}>
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search all table fields</span>
            <input
              type="search"
              value={search}
              placeholder="Search all fields, including raw_json…"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className={styles.pageSize}>
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100, 250].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.summary} aria-label="Result summary">
        <article>
          <span>Table</span>
          <strong>{table}</strong>
        </article>
        <article>
          <span>Matching records</span>
          <strong>
            {loading && !activePayload ? "…" : total.toLocaleString()}
          </strong>
        </article>
        <article>
          <span>Selected</span>
          <strong>{selectedRows.size.toLocaleString()}</strong>
        </article>
        <article>
          <span>Page</span>
          <strong>
            {Math.min(page, totalPages)} / {totalPages}
          </strong>
        </article>
      </section>

      <section
        className={styles.tableSurface}
        aria-labelledby="explorer-table-heading"
      >
        <div className={styles.tableHeading}>
          <div>
            <p>DATABASE RECORDS</p>
            <h2 id="explorer-table-heading">
              {loading && !activePayload
                ? "Loading records…"
                : `${total.toLocaleString()} rows from ${table}`}
            </h2>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() =>
                void copyRows(
                  selected,
                  `${selected.length} selected records copied`,
                )
              }
            >
              <ClipboardCopy size={15} /> Copy selected
            </button>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => {
                downloadCsv(selected, columns, `${table}-selected.csv`);
                setStatus(`${selected.length} selected records exported`);
              }}
            >
              <Download size={15} /> Export selected
            </button>
            <button
              type="button"
              disabled={Boolean(allAction) || !dateRangeValid}
              onClick={() => void handleAll("copy")}
            >
              {allAction === "copy" ? (
                <LoaderCircle className={styles.spin} size={15} />
              ) : (
                <Copy size={15} />
              )}
              Copy all
            </button>
            <button
              type="button"
              disabled={Boolean(allAction) || !dateRangeValid}
              onClick={() => void handleAll("export")}
            >
              {allAction === "export" ? (
                <LoaderCircle className={styles.spin} size={15} />
              ) : (
                <Download size={15} />
              )}
              Export all CSV
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error.message}
          </div>
        )}
        <p className={styles.status} aria-live="polite">
          {status}
        </p>

        <div
          className={styles.tableScroll}
          role="region"
          aria-label="Scrollable database records"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th className={styles.selectionCell}>
                  <input
                    type="checkbox"
                    aria-label="Select all records on this page"
                    checked={allPageRowsSelected}
                    onChange={togglePage}
                    disabled={!displayedRows.length}
                  />
                </th>
                {columns.map((column) => (
                  <th key={column}>
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() => changeSort(column)}
                      aria-label={`Sort by ${humaniseColumn(column)}`}
                    >
                      {humaniseColumn(column)}
                      {sortColumn === column ? (
                        sortDirection === "asc" ? (
                          <ArrowUp size={13} aria-label="ascending" />
                        ) : (
                          <ArrowDown size={13} aria-label="descending" />
                        )
                      ) : (
                        <ChevronsUpDown size={13} aria-hidden="true" />
                      )}
                    </button>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => {
                const id = explorerRowId(table, row);
                const rowSelected = selectedRows.has(id);
                return (
                  <tr
                    key={id}
                    className={rowSelected ? styles.selectedRow : ""}
                  >
                    <td className={styles.selectionCell}>
                      <input
                        type="checkbox"
                        aria-label={`Select record ${cellText(row.id ?? id)}`}
                        checked={rowSelected}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column}>
                        {column === "raw_json" ? (
                          <button
                            type="button"
                            className={styles.jsonButton}
                            onClick={() => setDetailRow(row)}
                          >
                            <FileJson size={14} /> View JSON
                          </button>
                        ) : (
                          <span title={cellText(row[column])}>
                            {cellText(row[column])}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className={styles.rowActions}>
                      <button
                        type="button"
                        title="Copy this record"
                        aria-label={`Copy record ${cellText(row.id ?? id)}`}
                        onClick={() =>
                          void writeClipboard(JSON.stringify(row, null, 2))
                            .then(() => setStatus("Record copied"))
                            .catch(() =>
                              setStatus("Record could not be copied"),
                            )
                        }
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        title="Export this record as CSV"
                        aria-label={`Export record ${cellText(row.id ?? id)} as CSV`}
                        onClick={() => {
                          downloadCsv(
                            [row],
                            columns,
                            `${table}-${cellText(row.id ?? "record")}.csv`,
                          );
                          setStatus("Record exported");
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        title="Open record detail"
                        aria-label={`Open record detail ${cellText(row.id ?? id)}`}
                        onClick={() => setDetailRow(row)}
                      >
                        <FileJson size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && !displayedRows.length && (
                <tr>
                  <td className={styles.empty} colSpan={columns.length + 2}>
                    No records match the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className={styles.pagination}>
          <span>
            {total
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`
              : "0 records"}
          </span>
          <div>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>

      {detailRow && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setDetailRow(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className={styles.drawerOverlay} />
            <Dialog.Content className={styles.drawerContent}>
              <div className={styles.detailHeading}>
                <div>
                  <p>STRUCTURED JSON</p>
                  <Dialog.Title>Record detail</Dialog.Title>
                  <Dialog.Description>
                    {detailRow.id !== undefined
                      ? `Raw JSON for record ${String(detailRow.id)}`
                      : `Raw JSON from ${table}`}
                  </Dialog.Description>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      void writeClipboard(explorerJsonText(detailValue))
                        .then(() => setStatus("JSON copied"))
                        .catch(() => setStatus("JSON could not be copied"))
                    }
                  >
                    <Copy size={15} /> Copy JSON
                  </button>
                  <Dialog.Close aria-label="Close record detail">
                    <X size={17} aria-hidden="true" />
                  </Dialog.Close>
                </div>
              </div>
              <div className={styles.jsonTree}>
                <JsonNode value={parseExplorerJson(detailValue)} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

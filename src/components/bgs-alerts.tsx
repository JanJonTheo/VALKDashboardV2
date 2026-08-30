"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Check,
  CheckCheck,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import type { BgsAlert, BgsRuleOwnerScope, BgsSeverity } from "@/lib/bgs-rules";

interface Filters {
  status: "all" | "active" | "resolved";
  scope: "all" | BgsRuleOwnerScope;
  severity: "all" | BgsSeverity;
  system: string;
}

async function loadAlerts(
  filters: Filters,
): Promise<{ data: BgsAlert[]; unread_count: number }> {
  const parameters = new URLSearchParams({
    status: filters.status,
    scope: filters.scope,
    severity: filters.severity,
  });
  if (filters.system.trim()) parameters.set("system", filters.system.trim());
  const response = await fetch(`/api/bgs-alerts?${parameters}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    data?: BgsAlert[];
    unread_count?: number;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Alerts could not be loaded");
  return { data: payload.data ?? [], unread_count: payload.unread_count ?? 0 };
}

async function updateAlert(
  id: string,
  state: { read?: boolean; acknowledged?: boolean },
) {
  const response = await fetch(`/api/bgs-alerts/${id}/state`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Alert state could not be updated",
    );
}

export function BgsAlerts() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    scope: "all",
    severity: "all",
    system: "",
  });
  const query = useQuery({
    queryKey: ["bgs-alerts", filters],
    queryFn: () => loadAlerts(filters),
    refetchInterval: 60_000,
  });
  const mutation = useMutation({
    mutationFn: ({
      id,
      state,
    }: {
      id: string;
      state: { read?: boolean; acknowledged?: boolean };
    }) => updateAlert(id, state),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bgs-alerts"] });
      window.dispatchEvent(new CustomEvent("valk:alerts-updated"));
    },
  });
  const systems = [
    ...new Set((query.data?.data ?? []).map((alert) => alert.system_name)),
  ].sort();
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">INTELLIGENCE / BGS ALERTS</p>
          <h1>Alert centre</h1>
          <p>
            Persistent personal and tenant-wide signals from settled BGS
            snapshots.
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
            <RefreshCw className={query.isFetching ? "spin" : ""} size={15} />{" "}
            Refresh
          </button>
        </div>
      </header>
      <section className="surface bgs-alert-toolbar">
        <div className="watchlist-summary">
          <strong>{query.data?.unread_count ?? 0}</strong>
          <span>unread alerts</span>
        </div>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value as Filters["status"],
              })
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label>
          <span>Ownership</span>
          <select
            value={filters.scope}
            onChange={(event) =>
              setFilters({
                ...filters,
                scope: event.target.value as Filters["scope"],
              })
            }
          >
            <option value="all">All</option>
            <option value="personal">Personal</option>
            <option value="tenant">Tenant-wide</option>
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select
            value={filters.severity}
            onChange={(event) =>
              setFilters({
                ...filters,
                severity: event.target.value as Filters["severity"],
              })
            }
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label>
          <span>System</span>
          <select
            value={filters.system}
            onChange={(event) =>
              setFilters({ ...filters, system: event.target.value })
            }
          >
            <option value="">All systems</option>
            {systems.map((system) => (
              <option value={system} key={system}>
                {system}
              </option>
            ))}
          </select>
        </label>
      </section>
      {query.isError && (
        <div className="error-banner" role="alert">
          <ShieldAlert size={18} />
          <div>
            <strong>Could not load alerts</strong>
            <span>{query.error.message}</span>
          </div>
        </div>
      )}
      <section className="bgs-alert-list" aria-busy={query.isPending}>
        {query.isPending && <p className="inline-empty">Loading BGS alerts…</p>}
        {!query.isPending && !query.data?.data.length && (
          <div className="surface watchlist-empty">
            <BellRing size={24} />
            <div>
              <strong>No matching alerts</strong>
              <span>
                Rules will create an entry here when their condition changes to
                active.
              </span>
            </div>
          </div>
        )}
        {query.data?.data.map((alert) => (
          <article
            className={`surface bgs-alert-card ${alert.severity}${alert.read_at ? " read" : " unread"}${alert.resolved_at ? " resolved" : ""}`}
            key={alert.id}
          >
            <header>
              <div>
                <span className={`severity-pill ${alert.severity}`}>
                  {alert.severity}
                </span>
                <span className="scope-pill">
                  {alert.owner_scope === "tenant" ? "Tenant" : "Personal"}
                </span>
                {alert.resolved_at ? (
                  <span className="resolved-pill">Resolved</span>
                ) : (
                  <span className="active-pill">Active</span>
                )}
              </div>
              <time>{new Date(alert.fired_at).toLocaleString("en-GB")}</time>
            </header>
            <h2>{alert.title}</h2>
            <p>{alert.message}</p>
            <footer>
              <span>
                {alert.rule_name} · settled tick {alert.fired_ticktime}
              </span>
              <div>
                {!alert.read_at && (
                  <button
                    className="secondary-button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ id: alert.id, state: { read: true } })
                    }
                  >
                    <Check size={13} /> Mark read
                  </button>
                )}
                {!alert.acknowledged_at && (
                  <button
                    className="secondary-button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        id: alert.id,
                        state: { read: true, acknowledged: true },
                      })
                    }
                  >
                    <CheckCheck size={13} /> Acknowledge
                  </button>
                )}
              </div>
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}

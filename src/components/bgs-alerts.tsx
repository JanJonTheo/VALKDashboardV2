"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { SystemLinksMenu } from "@/components/watchlist-system-actions";
import {
  AlertSystemDetails,
  AlertSystemMap,
} from "@/components/alert-system-details";
import { AlertDiscordButton } from "@/components/alert-discord-button";
import { AlertLifecycleActions } from "@/components/alert-lifecycle-actions";
import { AlertSystemStrip } from "@/components/alert-system-strip";
import { useAlertSystems } from "@/lib/use-alert-systems";
import { alertContext } from "@/lib/alert-context";
import type { BgsAlert } from "@/lib/bgs-rules";
import { loadBgsAlerts, type BgsAlertFilters } from "@/lib/bgs-alerts-client";
import { viewFilterString, type ViewPreference } from "@/lib/preferences";
import { useStoredViewPreference } from "@/lib/use-view-preference";
import { PageViewRegistration } from "@/components/page-view-context";
import { SavedViewsControl } from "@/components/saved-views-control";
import { MarkAllAlertsRead } from "@/components/mark-all-alerts-read";

async function updateAlert(id: string, state: { read?: boolean }) {
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

export function BgsAlerts({
  canSendDiscord = false,
  canRunBgsAi = false,
  isAdmin = false,
}: {
  canSendDiscord?: boolean;
  canRunBgsAi?: boolean;
  isAdmin?: boolean;
}) {
  const [detailAlert, setDetailAlert] = useState<BgsAlert | null>(null);
  const [mapSystem, setMapSystem] = useState<string | null>(null);
  const [markedCount, setMarkedCount] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const defaults = useMemo<ViewPreference>(
    () => ({
      filters: { status: "all", scope: "all", severity: "all", system: "" },
      sorting: [],
      visibleColumns: [],
      pageSize: 25,
    }),
    [],
  );
  const savedView = useStoredViewPreference("bgs-alerts-view-state", defaults);
  const filters: BgsAlertFilters = {
    status: (viewFilterString(savedView.view.filters.status) ||
      "all") as BgsAlertFilters["status"],
    scope: (viewFilterString(savedView.view.filters.scope) ||
      "all") as BgsAlertFilters["scope"],
    severity: (viewFilterString(savedView.view.filters.severity) ||
      "all") as BgsAlertFilters["severity"],
    system: viewFilterString(savedView.view.filters.system),
  };
  const setFilters = (next: BgsAlertFilters) =>
    savedView.setView((current) => ({ ...current, filters: { ...next } }));
  const query = useQuery({
    queryKey: ["bgs-alerts", filters],
    queryFn: () => loadBgsAlerts(filters),
    refetchInterval: (query) =>
      query.state.data?.data.some((alert) =>
        ["pending", "processing", "retry"].includes(
          alert.discord?.status ?? "",
        ),
      )
        ? 5_000
        : 60_000,
  });
  const mutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: { read?: boolean } }) =>
      updateAlert(id, state),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bgs-alerts"] });
      window.dispatchEvent(new CustomEvent("valk:alerts-updated"));
    },
  });
  const systems = [
    ...new Set((query.data?.data ?? []).map((alert) => alert.system_name)),
  ].sort();
  const {
    listRef: alertListRef,
    lookup: currentSystem,
    failed: systemLoadFailed,
  } = useAlertSystems(systems);
  return (
    <>
      <PageViewRegistration
        controller={{
          reset: savedView.reset,
          refresh: () =>
            queryClient.invalidateQueries({ queryKey: ["bgs-alerts"] }),
        }}
      />
      <header className="page-header">
        <div>
          <p className="eyebrow">INTELLIGENCE / BGS ALERTS</p>
          <h1>Alert Center</h1>
          <p>
            Persistent personal and tenant-wide signals from settled BGS
            snapshots. Resolved alerts are automatically deleted after 10 days.
          </p>
        </div>
        <div className="bgs-alert-header-actions">
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
          <MarkAllAlertsRead isAdmin={isAdmin} onMarked={setMarkedCount} />
          <SavedViewsControl model={savedView} />
        </div>
      </header>
      <section className="surface bgs-alert-toolbar">
        <div className="bgs-alert-summary-counts">
          <div className="watchlist-summary">
            <strong>{query.data?.unread_count ?? 0}</strong>
            <span>unread alerts</span>
          </div>
          {markedCount !== null && (
            <div className="watchlist-summary" role="status">
              <strong>{markedCount}</strong>
              <span>alerts marked as read</span>
            </div>
          )}
        </div>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value as BgsAlertFilters["status"],
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
                scope: event.target.value as BgsAlertFilters["scope"],
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
                severity: event.target.value as BgsAlertFilters["severity"],
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
      <section
        ref={alertListRef}
        className="bgs-alert-list"
        aria-busy={query.isPending}
      >
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
            className={`surface bgs-alert-card compact-alert ${alert.severity}${alert.read_at ? " read" : " unread"}${alert.resolved_at ? " resolved" : ""}`}
            data-alert-system={alert.system_name}
            key={alert.id}
          >
            <div className="bgs-alert-system-row">
              <h2>
                <button
                  className="bgs-alert-system-name"
                  onClick={() => setDetailAlert(alert)}
                >
                  {alert.system_name}
                </button>
              </h2>
              <SystemLinksMenu
                system={alert.system_name}
                onDetails={() => setDetailAlert(alert)}
                onMap={() => setMapSystem(alert.system_name)}
              />
            </div>
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
            <AlertSystemStrip
              alert={alert}
              system={currentSystem(alert.system_name)}
              failed={systemLoadFailed}
            />
            <footer>
              <span>Current faction values</span>
              <div>
                {canSendDiscord && <AlertDiscordButton alert={alert} />}
                <AlertLifecycleActions alert={alert} />
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
              </div>
            </footer>
          </article>
        ))}
      </section>
      {detailAlert && (
        <AlertSystemDetails
          key={detailAlert.id}
          system={detailAlert.system_name}
          context={alertContext(detailAlert)}
          onClose={() => setDetailAlert(null)}
          canRunBgsAi={canRunBgsAi}
        />
      )}
      {mapSystem && (
        <AlertSystemMap
          system={mapSystem}
          open
          onOpenChange={(open) => {
            if (!open) setMapSystem(null);
          }}
        />
      )}
    </>
  );
}

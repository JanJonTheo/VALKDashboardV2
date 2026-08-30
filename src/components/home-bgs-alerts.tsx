"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing } from "lucide-react";
import { loadBgsAlerts, type BgsAlertFilters } from "@/lib/bgs-alerts-client";

const currentAlertFilters: BgsAlertFilters = {
  status: "active",
  scope: "all",
  severity: "all",
  system: "",
};

function formatAlertTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return `${date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

export function HomeBgsAlerts({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ["bgs-alerts", "home", tenantId],
    queryFn: () => loadBgsAlerts(currentAlertFilters, 200),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const alerts = query.data?.data ?? [];

  return (
    <article className="surface home-alerts">
      <div className="section-heading">
        <div>
          <p className="eyebrow">BGS ALERTS</p>
          <h2>Current warnings</h2>
        </div>
        <Link href="/intelligence/alerts">
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {query.isError ? (
        <div className="home-alert-state" role="alert">
          <AlertTriangle size={17} />
          <span>
            <strong>Alerts unavailable</strong>
            <small>{query.error.message}</small>
          </span>
        </div>
      ) : query.isPending ? (
        <div className="home-alert-state" aria-live="polite">
          <BellRing size={17} />
          <span>
            <strong>Loading current alerts…</strong>
            <small>Checking active personal and tenant rules.</small>
          </span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="home-alert-state home-alert-empty">
          <BellRing size={17} />
          <span>
            <strong>No active BGS alerts</strong>
            <small>All monitored conditions are currently stable.</small>
          </span>
        </div>
      ) : (
        <>
          <div className="home-alert-summary" aria-live="polite">
            <span>
              <strong>{alerts.length}</strong> active
            </span>
            <span>{query.data?.unread_count ?? 0} unread</span>
          </div>
          <div
            className="home-alert-list"
            role="list"
            aria-label="Current BGS alerts"
          >
            {alerts.map((alert) => (
              <article
                className={`home-alert-item ${alert.severity}${alert.read_at ? " read" : " unread"}`}
                key={alert.id}
                role="listitem"
              >
                <div>
                  <span className={`severity-pill ${alert.severity}`}>
                    {alert.severity}
                  </span>
                  <time dateTime={alert.fired_at}>
                    {formatAlertTime(alert.fired_at)}
                  </time>
                </div>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
                <small>
                  {alert.system_name} · {alert.rule_name}
                </small>
              </article>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

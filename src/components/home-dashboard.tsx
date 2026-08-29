"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import type { DashboardSession } from "@/lib/access";
import { formatValue } from "@/lib/utils";

interface HomePayload {
  metrics: {
    activeCommanders: number;
    influence: number;
    bountyVouchers: number;
    openObjectives: number;
  };
  activity: {
    cmdr: string;
    actions: number;
    missions: number;
    influence: number;
  }[];
  objectives: {
    title?: string;
    system?: string;
    progress?: number;
    status?: string;
  }[];
  generated_at: string;
  tenant: string;
}

async function getHome(): Promise<HomePayload> {
  const response = await fetch("/api/bff/home", { credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Dashboard home is unavailable");
  }
  return response.json();
}

export function HomeDashboard({ session }: { session: DashboardSession }) {
  const query = useQuery({
    queryKey: ["home", session.tenant.id],
    queryFn: getHome,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const data = query.data;
  const metrics = [
    {
      label: "Active commanders",
      value: data?.metrics.activeCommanders,
      detail: "Recorded in the current tick",
      icon: Users,
    },
    {
      label: "Influence contribution",
      value: data?.metrics.influence,
      detail: "Influence points in the current tick",
      icon: Activity,
    },
    {
      label: "Bounty vouchers",
      value: data?.metrics.bountyVouchers,
      detail: "Redeemed in the current tick",
      icon: Database,
    },
    {
      label: "Open objectives",
      value: data?.metrics.openObjectives,
      detail: "Active tenant objectives",
      icon: Target,
    },
  ];
  const maximumActivity = Math.max(
    1,
    ...(data?.activity.map((item) => item.actions) ?? []),
  );
  const generatedAt = data?.generated_at ? new Date(data.generated_at) : null;

  return (
    <>
      <header className="page-header home-header">
        <div>
          <p className="eyebrow">HOME / COMMAND CENTER</p>
          <h1>Welcome, CMDR {session.user.name}.</h1>
          <p>
            {session.tenant.name} activity, objectives and BGS intelligence at a
            glance.
          </p>
        </div>
        <div>
          <span className="live-status">
            <i />
            Current tick
          </span>
          <button className="secondary-button" onClick={() => query.refetch()}>
            <RefreshCw className={query.isFetching ? "spin" : ""} size={15} />
            Refresh all
          </button>
          <small>
            {generatedAt
              ? generatedAt.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "UTC",
                }) + " UTC"
              : "Connecting…"}
          </small>
        </div>
      </header>

      {query.isError && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>Could not update the command center</strong>
            <span>{query.error.message}</span>
          </div>
          <button onClick={() => query.refetch()}>Retry</button>
        </div>
      )}

      <section className="metric-strip home-metrics">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <article key={label}>
            <Icon size={18} />
            <span>{label}</span>
            <strong>{query.isLoading ? "…" : formatValue(value)}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section className="home-grid">
        <article className="surface home-activity">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACTIVITY</p>
              <h2>Recorded actions this tick</h2>
            </div>
            <Link href="/analytics/leaderboard?period=ct">
              Full analytics <ArrowRight size={13} />
            </Link>
          </div>
          {data?.activity.length ? (
            <>
              <div className="home-chart">
                {data.activity.slice(0, 12).map((item) => (
                  <div key={item.cmdr} title={`${item.cmdr}: ${item.actions}`}>
                    <i
                      style={{
                        height: `${Math.max(3, (item.actions / maximumActivity) * 100)}%`,
                      }}
                    />
                    <span>{item.cmdr.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
              <div className="home-chart-legend">
                <span>
                  <i />
                  Missions and influence entries
                </span>
              </div>
            </>
          ) : (
            <p className="inline-empty">
              No commander activity is recorded for the current tick.
            </p>
          )}
        </article>

        <article className="surface tick-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DATA SNAPSHOT</p>
              <h2>Last tenant refresh</h2>
            </div>
            <Clock3 size={17} />
          </div>
          <div className="tick-time">
            <strong>
              {generatedAt
                ? generatedAt.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })
                : "—"}
            </strong>
          </div>
          <small>UTC · SMART REFRESH EVERY 60 SECONDS</small>
          <p>All values above use explicit current-tick API filters.</p>
        </article>

        <article className="surface home-objectives">
          <div className="section-heading">
            <div>
              <p className="eyebrow">OPERATIONS</p>
              <h2>Active objectives</h2>
            </div>
            <Link href="/operations/objectives?active=true">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {data?.objectives.length ? (
            <div>
              {data.objectives.map((item, index) => {
                const progress = Number(item.progress) || 0;
                return (
                  <div
                    className="home-objective"
                    key={`${item.title}-${index}`}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item.title || "Untitled objective"}</strong>
                      <small>{item.system || "No system"}</small>
                      <div>
                        <i style={{ width: `${Math.min(100, progress)}%` }} />
                      </div>
                    </div>
                    <b>{formatValue(progress)}%</b>
                    <em className={item.status === "Expired" ? "risk" : ""}>
                      {item.status || "Active"}
                    </em>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="inline-empty">
              No active objectives are configured for this tenant.
            </p>
          )}
        </article>

        <article className="surface command-tools">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SHORTCUTS</p>
              <h2>Command tools</h2>
            </div>
            <Gauge size={17} />
          </div>
          <div>
            <Link href="/intelligence/systems">
              <Activity size={16} />
              <span>
                System lookup<small>EDDN intelligence</small>
              </span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/operations/colonisation">
              <Target size={16} />
              <span>
                Colonisation<small>Construction progress</small>
              </span>
              <ArrowRight size={14} />
            </Link>
            <Link href="/intelligence/factions-24h">
              <ShieldAlert size={16} />
              <span>
                24h report<small>Faction movement</small>
              </span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </article>

        <article className="surface system-health">
          <div>
            {query.isSuccess ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            <span>
              <strong>
                {query.isSuccess
                  ? "Tenant API and database connected"
                  : "Tenant data connection unavailable"}
              </strong>
              <small>
                Values are loaded through the authenticated dashboard BFF.
              </small>
            </span>
          </div>
          <Link href="/admin/health">
            Service detail <ArrowRight size={13} />
          </Link>
        </article>

        <article className="surface bot-reminder">
          <Bot size={20} />
          <div>
            <strong>Discord commands remain available</strong>
            <p>
              Manual BGS capture, system maps, mining, exobiology and personal
              reports continue through VALKDiscordBot.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}

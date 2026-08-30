"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Compass,
  Database,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { HomeActivityChart } from "@/components/home-activity-chart";
import { HomeBgsAlerts } from "@/components/home-bgs-alerts";
import type { DashboardSession } from "@/lib/access";
import {
  formatTickCountdown,
  getTickSchedule,
  type HomeActivityRow,
  type HomeMetrics,
} from "@/lib/home";
import { formatValue } from "@/lib/utils";

interface HomePayload {
  metrics: HomeMetrics;
  activity: HomeActivityRow[];
  objectives: {
    title?: string;
    system?: string;
    progress?: number;
    status?: string;
  }[];
  generated_at: string;
  last_tick: string | null;
  tenant: string;
}

function formatUtcDateTime(value: Date | null) {
  if (!value) return "—";
  return `${value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })} UTC`;
}

function TickCountdown({ nextTick }: { nextTick: Date | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const countdown = formatTickCountdown(nextTick, now);

  return (
    <>
      <div className="tick-time tick-countdown">
        <strong
          role="timer"
          aria-label={
            countdown === "—"
              ? "Time to next tick unavailable"
              : `Time to next tick: ${countdown}`
          }
        >
          {countdown}
        </strong>
      </div>
      <small>
        {countdown.startsWith("Overdue")
          ? "MINUTES SINCE ESTIMATED TICK"
          : "HOURS : MINUTES"}
      </small>
    </>
  );
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
  const queryClient = useQueryClient();
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
      detail: "Credits redeemed in the current tick",
      icon: Database,
    },
    {
      label: "Exploration sales",
      value: data?.metrics.explorationSales,
      detail: "Credits sold in the current tick",
      icon: Compass,
    },
    {
      label: "Combat bonds",
      value: data?.metrics.combatBonds,
      detail: "Credits redeemed in the current tick",
      icon: Swords,
    },
    {
      label: "Trade volume",
      value: data?.metrics.tradeVolume,
      detail: "Credits traded in the current tick",
      icon: TrendingUp,
    },
    {
      label: "Open objectives",
      value: data?.metrics.openObjectives,
      detail: "Active tenant objectives",
      icon: Target,
    },
  ];
  const generatedAt = data?.generated_at ? new Date(data.generated_at) : null;
  const tickSchedule = getTickSchedule(data?.last_tick);
  const refreshAll = async () => {
    window.dispatchEvent(new CustomEvent("valk:refresh"));
    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["bgs-alerts"] }),
    ]);
  };

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
          <button
            className="secondary-button"
            onClick={() => void refreshAll()}
          >
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
        <div className="home-command-column home-primary-column">
          <article className="surface home-activity">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ACTIVITY</p>
                <h2>Contribution share by commander</h2>
              </div>
              <Link href="/analytics/leaderboard?period=ct">
                Full analytics <ArrowRight size={13} />
              </Link>
            </div>
            {data?.activity.length ? (
              <HomeActivityChart rows={data.activity} totals={data.metrics} />
            ) : (
              <p className="inline-empty">
                No commander activity is recorded for the current tick.
              </p>
            )}
          </article>

          <HomeBgsAlerts tenantId={session.tenant.id} />

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
              <div className="home-objective-list">
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
        </div>

        <div className="home-command-column home-secondary-column tick-card-stack">
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

          <article className="surface tick-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TICK TIMER</p>
                <h2>Time to next tick</h2>
              </div>
              <Timer size={17} />
            </div>
            <TickCountdown nextTick={tickSchedule.estimatedNextTick} />
            <div className="tick-schedule" aria-label="Galaxy tick schedule">
              <div>
                <span>Last tick</span>
                {tickSchedule.lastTick ? (
                  <time dateTime={tickSchedule.lastTick.toISOString()}>
                    {formatUtcDateTime(tickSchedule.lastTick)}
                  </time>
                ) : (
                  <time>—</time>
                )}
              </div>
              <div>
                <span>Est. next tick</span>
                {tickSchedule.estimatedNextTick ? (
                  <time dateTime={tickSchedule.estimatedNextTick.toISOString()}>
                    {formatUtcDateTime(tickSchedule.estimatedNextTick)}
                  </time>
                ) : (
                  <time>—</time>
                )}
              </div>
            </div>
            <p>Next tick estimate = last observed tick + 24 hours.</p>
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
        </div>

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

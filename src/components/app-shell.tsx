"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  BellRing,
  Bot,
  ChevronDown,
  Compass,
  Database,
  Gauge,
  Home,
  LogOut,
  Menu,
  Orbit,
  RefreshCw,
  Shield,
  ShieldCheck,
  Swords,
  Target,
  Users,
  ListChecks,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { DashboardSession } from "@/lib/access";
import { cn } from "@/lib/utils";
import { usePageViewActions } from "@/components/page-view-context";

const groups = [
  { label: "Overview", links: [{ href: "/", label: "Home", icon: Home }] },
  {
    label: "Analytics",
    links: [
      { href: "/analytics/leaderboard", label: "Leaderboard", icon: BarChart3 },
      { href: "/analytics/evaluations", label: "Evaluations", icon: Activity },
      {
        href: "/analytics/monthly-performance",
        label: "Monthly performance",
        icon: Gauge,
      },
      { href: "/analytics/commanders", label: "Commanders", icon: Users },
      { href: "/analytics/recruits", label: "Recruits", icon: Shield },
      {
        href: "/analytics/bounty-vouchers",
        label: "Bounty vouchers",
        icon: Database,
      },
      {
        href: "/analytics/conflict-zones",
        label: "Conflict zones",
        icon: Swords,
      },
    ],
  },
  {
    label: "Operations",
    links: [
      { href: "/operations/objectives", label: "Objectives", icon: Target },
      { href: "/operations/colonisation", label: "Colonisation", icon: Orbit },
    ],
  },
  {
    label: "Intelligence",
    links: [
      {
        href: "/intelligence/watchlist",
        label: "BGS watchlist",
        icon: ListChecks,
      },
      {
        href: "/intelligence/alerts",
        label: "BGS alerts",
        icon: BellRing,
      },
      {
        href: "/intelligence/systems",
        label: "System intelligence",
        icon: Compass,
      },
      {
        href: "/intelligence/factions-24h",
        label: "24h faction report",
        icon: Activity,
      },
    ],
  },
  {
    label: "Administration",
    admin: true,
    links: [
      { href: "/admin/users", label: "User administration", icon: Users },
      {
        href: "/admin/protected-factions",
        label: "Protected factions",
        icon: ShieldCheck,
      },
      { href: "/admin/data-explorer", label: "Data explorer", icon: Database },
      { href: "/admin/health", label: "Service & audit", icon: Bot },
    ],
  },
];

export function AppShell({
  children,
  session,
}: {
  children: ReactNode;
  session: DashboardSession;
}) {
  const path = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const { resetAndRefresh, refreshing, updatedLabel } = usePageViewActions();
  const visibleGroups = groups.filter(
    (group) => !group.admin || session.role === "admin",
  );
  const signOut = async () => {
    await fetch("/api/session/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/sign-in");
    router.refresh();
  };
  useEffect(() => {
    let active = true;
    const load = () => {
      void fetch("/api/bgs-alerts?limit=1", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (active && typeof payload?.unread_count === "number")
            setUnreadAlerts(payload.unread_count);
        });
    };
    load();
    const interval = window.setInterval(load, 60_000);
    window.addEventListener("valk:alerts-updated", load);
    window.addEventListener("valk:refresh", load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("valk:alerts-updated", load);
      window.removeEventListener("valk:refresh", load);
    };
  }, []);

  return (
    <div className="app-frame">
      {menuOpen && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={cn("app-sidebar", menuOpen && "open")}>
        <div className="brand sidebar-brand">
          <span className="brand-signet sidebar-signet">
            <Image
              src="/valkyries-trade-war.jpg"
              alt="Valkyries of Trade & War"
              width={200}
              height={200}
              priority
            />
          </span>
          <button
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        {session.tenant.factionName && (
          <div className="tenant-faction">
            <span className="tenant-faction-name">
              {session.tenant.factionName}
            </span>
          </div>
        )}
        <nav aria-label="Main navigation">
          {visibleGroups.map((group) => (
            <section className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.links.map(({ href, label, icon: Icon }) => (
                <Link
                  aria-label={label}
                  title={label}
                  onClick={() => setMenuOpen(false)}
                  key={href}
                  href={href}
                  className={cn("nav-item", path === href && "active")}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {href === "/intelligence/alerts" && unreadAlerts > 0 && (
                    <b
                      className="nav-alert-badge"
                      aria-label={`${unreadAlerts} unread BGS alerts`}
                    >
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </b>
                  )}
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="discord-channel">
          <Bot size={17} />
          <div>
            <strong>Discord bot connected</strong>
            <span>Commands remain available</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          {session.availableTenants.length > 1 ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="tenant-switcher">
                {session.tenant.name}
                <ChevronDown size={14} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="tenant-menu" sideOffset={8}>
                  {session.availableTenants.map((tenant) => (
                    <DropdownMenu.Item
                      className="tenant-menu-item"
                      key={tenant.id}
                      onSelect={async () => {
                        await fetch("/api/tenant", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ tenantId: tenant.id }),
                        });
                        window.location.reload();
                      }}
                    >
                      {tenant.name}
                      {tenant.id === session.tenant.id && <span>Current</span>}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <div className="tenant-switcher tenant-current">
              {session.tenant.name}
            </div>
          )}
          <div className="topbar-spacer" />
          <button
            className="topbar-reset-refresh"
            onClick={() => void resetAndRefresh().then(() => router.refresh())}
            aria-label="Reset view and refresh dashboard"
            disabled={refreshing}
          >
            <span className="refresh-label">{updatedLabel}</span>
            <RefreshCw className={refreshing ? "spin" : ""} size={17} />
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="profile-button"
              aria-label="Account menu"
            >
              <span>{session.user.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{session.user.name}</strong>
                <small>{session.role}</small>
              </div>
              <ChevronDown size={13} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="tenant-menu account-menu"
                sideOffset={8}
                align="end"
              >
                <DropdownMenu.Label className="account-label">
                  Signed in to {session.tenant.name}
                </DropdownMenu.Label>
                <DropdownMenu.Item asChild className="tenant-menu-item">
                  <Link href="/account">
                    <Shield size={15} />
                    Profile & security
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="tenant-menu-item logout-item"
                  onSelect={signOut}
                >
                  <LogOut size={15} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>
        <main className="page-content">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <Link className={path === "/" ? "active" : ""} href="/">
          <Home size={19} />
          <span>Home</span>
        </Link>
        <Link
          className={path.startsWith("/analytics") ? "active" : ""}
          href="/analytics/leaderboard"
        >
          <BarChart3 size={19} />
          <span>Analytics</span>
        </Link>
        <Link
          className={path.startsWith("/operations") ? "active" : ""}
          href="/operations/objectives"
        >
          <Target size={19} />
          <span>Operations</span>
        </Link>
        <button onClick={() => setMenuOpen(true)}>
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}

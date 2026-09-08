"use client";
import {
  Building2,
  Flag,
  Clock3,
  Zap,
  Factory,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { WatchedFaction, WatchedSystem } from "@/lib/system-watchlist";
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

export function formatPopulation(value: number) {
  return new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value);
}

export function formatUpdated(value: string) {
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

export function BgsChip({
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

export function FactionCardContents({
  faction,
  colour,
}: {
  faction: WatchedFaction;
  colour: string;
}) {
  return (
    <>
      {" "}
      <div className="watch-faction-primary">
        <strong title={faction.name}>
          <i style={{ backgroundColor: colour }} />
          {faction.name}
        </strong>
        <b>
          {faction.influenceKnown === false
            ? "—"
            : `${faction.influence.toFixed(2)}%`}
        </b>
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
    </>
  );
}
export function SystemFacts({ system }: { system: WatchedSystem }) {
  return (
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
  );
}

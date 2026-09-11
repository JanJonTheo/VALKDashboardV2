"use client";
import { ConflictDetails } from "@/components/conflict-details";
import { normalizeConflict } from "@/lib/system-watchlist";
import { AlertTriangle, Info } from "lucide-react";
import { alertContext, factionKey } from "@/lib/alert-context";
import type { BgsAlert } from "@/lib/bgs-rules";
import {
  assignFactionColours,
  type WatchedSystem,
} from "@/lib/system-watchlist";
import {
  FactionCardContents,
  SystemFacts,
  factionFillStyle,
} from "./watchlist-parts";

export function AlertSystemStrip({
  alert,
  system,
  failed,
}: {
  alert: BgsAlert;
  system?: WatchedSystem;
  failed: boolean;
}) {
  const context = alertContext(alert);
  const colours = assignFactionColours(system?.factions ?? []);
  return (
    <div className="alert-system-strip">
      <div
        className="alert-current-system"
        tabIndex={0}
        aria-label="Current system information"
      >
        {system?.available ? (
          <SystemFacts system={system} />
        ) : (
          <span>
            {failed || system
              ? "Current system data unavailable"
              : "Loading current system data…"}
          </span>
        )}
      </div>
      <details
        className={`alert-reason ${context.severity}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.open = false;
        }}
      >
        <summary>
          <AlertTriangle size={18} aria-hidden="true" />
          <strong>{context.summary}</strong>
          <span>{context.threshold} · at trigger</span>
          <Info size={13} aria-hidden="true" />
        </summary>
        <div className="alert-reason-popup">
          <strong>{alert.rule_name}</strong>
          <p>{context.message}</p>
          <p>Triggered: {context.timestamp}</p>
          {context.resolved && <p>This alert is resolved.</p>}
        </div>
      </details>
      <ConflictDetails
        title="Conflict at alert tick"
        conflicts={
          Array.isArray(alert.facts.new_conflicts)
            ? alert.facts.new_conflicts.map((value) =>
                normalizeConflict(value as Record<string, unknown>),
              )
            : []
        }
      />
      <div
        className="alert-factions"
        aria-label="Affected factions — current values"
        tabIndex={0}
      >
        {context.factions.length ? (
          context.factions.map((name) => {
            const faction = system?.factions.find(
              (item) => factionKey(item.name) === factionKey(name),
            );
            const colour = colours.get(faction?.name ?? name) ?? "#e8bd52";
            return (
              <article
                key={name}
                className="watch-faction-card alert-faction-card"
                style={faction ? factionFillStyle(faction, colour) : undefined}
                aria-label={`${name}, current influence ${faction && faction.influenceKnown !== false ? `${faction.influence.toFixed(2)} percent` : "unavailable"}`}
              >
                {faction ? (
                  <FactionCardContents faction={faction} colour={colour} />
                ) : (
                  <>
                    <strong>{name}</strong>
                    <span>Current influence —</span>
                    <small>
                      {failed || system
                        ? "Faction data unavailable"
                        : "Loading…"}
                    </small>
                  </>
                )}
              </article>
            );
          })
        ) : (
          <div className="alert-context-fallback">{context.message}</div>
        )}
      </div>
    </div>
  );
}

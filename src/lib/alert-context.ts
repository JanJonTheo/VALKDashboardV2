import type { BgsAlert } from "./bgs-rules";

export interface AlertContext {
  factions: string[];
  summary: string;
  threshold: string;
  timestamp: string;
  message: string;
  severity: BgsAlert["severity"];
  resolved: boolean;
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const list = (v: unknown) => (Array.isArray(v) ? v.map(object) : []);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const factionKey = (name: string) =>
  name.trim().normalize("NFC").toLocaleLowerCase("en");
const pp = (value: number) => `${value.toFixed(2)} pp`;

export function alertContext(alert: BgsAlert): AlertContext {
  const f = object(alert.facts);
  const principal =
    text(f.tenant_faction) ||
    text(f.monitored_faction) ||
    text(f.controlling_faction);
  let factions: string[] = [];
  let summary = "Alarm details";
  let threshold = "";
  const limit = number(f.threshold_pp);
  const entered = list(f.entered_factions);
  const gap =
    entered.find(
      (item) =>
        text(item.key) === alert.event_key ||
        `gap:${factionKey(text(item.faction))}` === alert.event_key,
    ) ?? (entered.length === 1 ? entered[0] : undefined);
  const conflicts = list(f.new_conflicts);
  const conflict =
    conflicts.find(
      (item) =>
        text(item.key) === alert.event_key ||
        `conflict:${text(item.type).toLocaleLowerCase("en")}:${[factionKey(text(item.faction1)), factionKey(text(item.faction2))].sort().join(":")}` ===
          alert.event_key,
    ) ?? (conflicts.length === 1 ? conflicts[0] : undefined);
  const change = object(f.strongest_change);
  if (gap && number(gap.gap_pp) !== null && principal && text(gap.faction)) {
    factions = [principal, text(gap.faction)];
    summary = `Gap ${pp(number(gap.gap_pp)!)}`;
    threshold = limit === null ? "" : `Threshold ${pp(limit)}`;
  } else if (number(f.gap_pp) !== null && text(f.competitor) && principal) {
    factions = [principal, text(f.competitor)];
    summary = `Gap ${pp(number(f.gap_pp)!)}`;
    threshold = limit === null ? "" : `Threshold ${pp(limit)}`;
  } else if (conflict && text(conflict.faction1) && text(conflict.faction2)) {
    factions = [text(conflict.faction1), text(conflict.faction2)];
    summary = `${conflict.is_update ? "Conflict update" : "New conflict"}: ${text(conflict.type) || text(conflict.war_type) || "Conflict"}`;
  } else if (number(f.loss_pp) !== null && principal) {
    factions = [principal];
    summary = `Loss ${pp(number(f.loss_pp)!)}`;
    threshold = limit === null ? "" : `Threshold ${pp(limit)}`;
  } else if (number(change.delta_pp) !== null && text(change.faction)) {
    factions = [text(change.faction)];
    const delta = number(change.delta_pp)!;
    summary = `${delta >= 0 ? "Gain" : "Loss"} ${pp(Math.abs(delta))}`;
    threshold = limit === null ? "" : `Threshold ${pp(limit)}`;
  } else if (
    !entered.length &&
    !conflicts.length &&
    (!alert.event_key ||
      alert.event_key === "condition" ||
      alert.event_key === "below") &&
    principal &&
    limit !== null
  ) {
    const influence =
      number(f.tenant_influence_pp) ?? number(f.controller_influence_pp);
    if (influence !== null && influence < limit) {
      factions = [principal];
      summary = `Influence ${influence.toFixed(2)}%`;
      threshold = `Below ${limit.toFixed(2)}%`;
    }
  }
  return {
    factions: [
      ...new Map(factions.map((name) => [factionKey(name), name])).values(),
    ],
    summary,
    threshold,
    timestamp: alert.fired_ticktime,
    message: alert.message,
    severity: alert.severity,
    resolved: !!alert.resolved_at,
  };
}

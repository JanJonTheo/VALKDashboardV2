import type { BgsAlert, BgsRuleOwnerScope, BgsSeverity } from "@/lib/bgs-rules";

export interface BgsAlertFilters {
  status: "all" | "active" | "resolved";
  scope: "all" | BgsRuleOwnerScope;
  severity: "all" | BgsSeverity;
  system: string;
}

export interface BgsAlertsPayload {
  data: BgsAlert[];
  unread_count: number;
}

export async function loadBgsAlerts(
  filters: BgsAlertFilters,
  limit?: number,
): Promise<BgsAlertsPayload> {
  const parameters = new URLSearchParams({
    status: filters.status,
    scope: filters.scope,
    severity: filters.severity,
  });
  if (filters.system.trim()) parameters.set("system", filters.system.trim());
  if (limit !== undefined) parameters.set("limit", String(limit));

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

  return {
    data: payload.data ?? [],
    unread_count: payload.unread_count ?? 0,
  };
}

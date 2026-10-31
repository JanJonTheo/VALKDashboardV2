import { flaskRequest } from "@/lib/flask";
import type { DashboardSession } from "@/lib/access";

/** Keep each Flask request within its 100-system limit. */
export async function fetchWatchlistData(
  request: Request,
  session: DashboardSession,
  systems: string[],
): Promise<Response> {
  const data: unknown[] = [];
  const types: Record<string, number> = {};
  let cachedSystems = 0;
  let generatedAt = new Date().toISOString();
  for (let offset = 0; offset < systems.length; offset += 100) {
    const response = await flaskRequest(
      "system-watchlist-data",
      new Request(request.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          systems: systems.slice(offset, offset + 100),
          history_days: 7,
        }),
      }),
      session,
    );
    if (!response.ok) return response;
    const payload = await response.json();
    data.push(...(Array.isArray(payload.data) ? payload.data : []));
    generatedAt = payload.generated_at ?? generatedAt;
    const facilities = payload.facility_statistics ?? {};
    cachedSystems += Number(facilities.cached_systems) || 0;
    for (const [key, value] of Object.entries(facilities.types ?? {}))
      types[key] = (types[key] ?? 0) + (Number(value) || 0);
  }
  return Response.json({
    data,
    generated_at: generatedAt,
    facility_statistics: {
      types,
      cached_systems: cachedSystems,
      requested_systems: systems.length,
    },
  });
}

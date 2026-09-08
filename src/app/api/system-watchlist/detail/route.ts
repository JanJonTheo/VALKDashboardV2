import { NextResponse } from "next/server";
import { proxyDashboardRoute } from "@/lib/route-proxy";
import { z } from "zod";

const batchSchema = z.object({
  systems: z.array(z.string().trim().min(2).max(255)).min(1).max(100),
});
export async function POST(request: Request) {
  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: { message: "Provide between 1 and 100 valid system names" } },
      { status: 400 },
    );
  const seen = new Set<string>();
  const systems = parsed.data.systems.filter((name) => {
    const key = name.toLocaleLowerCase("en");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const url = new URL(request.url);
  url.search = "";
  return proxyDashboardRoute(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systems, history_days: 7 }),
    }),
    "system-watchlist-data",
    "dashboard:read",
  );
}

export function GET(request: Request) {
  const system = new URL(request.url).searchParams.get("system")?.trim() ?? "";
  if (system.length < 2 || system.length > 255)
    return NextResponse.json(
      { error: { message: "A valid system name is required" } },
      { status: 400 },
    );
  const url = new URL(request.url);
  url.search = "";
  return proxyDashboardRoute(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systems: [system], history_days: 7 }),
    }),
    "system-watchlist-data",
    "dashboard:read",
  );
}

import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function GET(request: Request) {
  return proxyDashboardRoute(
    request,
    "admin/protected-factions",
    "protected-factions:manage",
  );
}

export async function POST(request: Request) {
  return proxyDashboardRoute(
    request,
    "admin/protected-factions",
    "protected-factions:manage",
  );
}

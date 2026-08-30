import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function GET(request: Request) {
  return proxyDashboardRoute(
    request,
    "admin/protected-factions/candidates",
    "protected-factions:manage",
  );
}

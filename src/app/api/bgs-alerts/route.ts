import { proxyDashboardRoute } from "@/lib/route-proxy";

export function GET(request: Request) {
  return proxyDashboardRoute(request, "dashboard/bgs/alerts", "dashboard:read");
}

import { proxyDashboardRoute } from "@/lib/route-proxy";

export function POST(request: Request) {
  return proxyDashboardRoute(
    request,
    "dashboard/bgs/alerts/read-all",
    "admin:read",
  );
}

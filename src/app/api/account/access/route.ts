import { proxyDashboardRoute } from "@/lib/route-proxy";

export function GET(request: Request) {
  return proxyDashboardRoute(request, "account/access");
}

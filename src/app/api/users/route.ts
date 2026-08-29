import { proxyDashboardRoute } from "@/lib/route-proxy";

export function GET(request: Request) {
  return proxyDashboardRoute(request, "admin/users", "users:manage");
}

export function POST(request: Request) {
  return proxyDashboardRoute(request, "admin/users", "users:manage");
}

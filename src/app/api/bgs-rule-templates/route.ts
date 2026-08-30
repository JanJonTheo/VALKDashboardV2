import { proxyDashboardRoute } from "@/lib/route-proxy";

export function GET(request: Request) {
  return proxyDashboardRoute(
    request,
    "dashboard/bgs/rule-templates",
    "rules:write",
  );
}

export function POST(request: Request) {
  return proxyDashboardRoute(
    request,
    "dashboard/bgs/rule-templates",
    "tenant-rules:write",
  );
}

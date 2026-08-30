import { proxyDashboardRoute } from "@/lib/route-proxy";

export function POST(request: Request) {
  return proxyDashboardRoute(
    request,
    "account/discord-webhook/test",
    "rules:write",
  );
}

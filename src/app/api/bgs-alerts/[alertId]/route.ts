import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const { alertId } = await params;
  return proxyDashboardRoute(
    request,
    `dashboard/bgs/alerts/${encodeURIComponent(alertId)}`,
    "dashboard:read",
  );
}

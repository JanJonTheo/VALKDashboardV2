import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params;
  return proxyDashboardRoute(
    request,
    `dashboard/bgs/rule-packages/${encodeURIComponent(packageId)}/sync`,
    "rules:write",
  );
}

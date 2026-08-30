import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/protected-factions/${encodeURIComponent(id)}/webhook-test`,
    "protected-factions:manage",
  );
}

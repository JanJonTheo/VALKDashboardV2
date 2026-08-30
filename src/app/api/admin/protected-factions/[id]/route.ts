import { proxyDashboardRoute } from "@/lib/route-proxy";

type ProtectedFactionRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  { params }: ProtectedFactionRouteContext,
) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/protected-factions/${encodeURIComponent(id)}`,
    "protected-factions:manage",
  );
}

export async function DELETE(
  request: Request,
  { params }: ProtectedFactionRouteContext,
) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/protected-factions/${encodeURIComponent(id)}`,
    "protected-factions:manage",
  );
}

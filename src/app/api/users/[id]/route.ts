import { proxyDashboardRoute } from "@/lib/route-proxy";

type UserRouteContext = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: UserRouteContext) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/users/${encodeURIComponent(id)}`,
    "users:manage",
  );
}

export async function DELETE(request: Request, { params }: UserRouteContext) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/users/${encodeURIComponent(id)}`,
    "users:manage",
  );
}

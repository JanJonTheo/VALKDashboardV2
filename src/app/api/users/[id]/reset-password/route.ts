import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyDashboardRoute(
    request,
    `admin/users/${encodeURIComponent(id)}/reset-password`,
    "users:manage",
  );
}

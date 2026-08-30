import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  return proxyDashboardRoute(
    request,
    `dashboard/bgs/rule-templates/${encodeURIComponent(templateId)}`,
    "tenant-rules:write",
  );
}

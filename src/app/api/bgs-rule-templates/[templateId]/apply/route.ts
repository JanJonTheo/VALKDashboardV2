import { proxyDashboardRoute } from "@/lib/route-proxy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  return proxyDashboardRoute(
    request,
    `dashboard/bgs/rule-templates/${encodeURIComponent(templateId)}/apply`,
    "rules:write",
  );
}

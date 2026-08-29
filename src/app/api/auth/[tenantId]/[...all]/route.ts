import { toNextJsHandler } from "better-auth/next-js";
import { getTenantAuth, syncLinkedSocialProfile } from "@/lib/better-auth";
import { normalizedOAuthLocation } from "@/lib/public-app-url";

function withPublicOAuthLocation(response: Response, request: Request) {
  const location = response.headers.get("location");
  if (!location) return response;

  const normalized = normalizedOAuthLocation(location, request.url).toString();
  if (normalized === location) return response;

  const headers = new Headers(response.headers);
  headers.set("location", normalized);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handle(
  request: Request,
  params: Promise<{ tenantId: string; all: string[] }>,
) {
  const { tenantId, all } = await params;
  if (all[0] === "sign-up" || (all[0] === "sign-in" && all[1] === "email"))
    return Response.json({ error: "Not found" }, { status: 404 });
  const handler = toNextJsHandler(await getTenantAuth(tenantId));
  const method = request.method as "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  const response = withPublicOAuthLocation(
    await handler[method](request),
    request,
  );
  const provider = all[0] === "callback" ? all[1] : undefined;
  if (provider === "discord" || provider === "google") {
    try {
      await syncLinkedSocialProfile(tenantId, provider, request);
    } catch {
      const location = response.headers.get("location");
      if (location) {
        const redirect = normalizedOAuthLocation(location, request.url);
        redirect.searchParams.set("socialError", "profile-sync-failed");
        const headers = new Headers(response.headers);
        headers.set("location", redirect.toString());
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    }
  }
  return response;
}

type AuthRouteContext = {
  params: Promise<{ tenantId: string; all: string[] }>;
};
export function GET(request: Request, { params }: AuthRouteContext) {
  return handle(request, params);
}
export function POST(request: Request, { params }: AuthRouteContext) {
  return handle(request, params);
}
export function PATCH(request: Request, { params }: AuthRouteContext) {
  return handle(request, params);
}
export function PUT(request: Request, { params }: AuthRouteContext) {
  return handle(request, params);
}
export function DELETE(request: Request, { params }: AuthRouteContext) {
  return handle(request, params);
}

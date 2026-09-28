import { NextResponse } from "next/server";
import { proxyDashboardRoute } from "@/lib/route-proxy";

const routes: Record<string, RegExp[]> = {
  GET: [/^devices$/, /^devices\/[a-f0-9]{32}\/commands\/[a-f0-9]{32}$/, /^devices\/[a-f0-9]{32}\/share-candidates$/],
  POST: [/^pairings$/, /^devices\/[a-f0-9]{32}\/viewers$/, /^devices\/[a-f0-9]{32}\/viewers\/[a-f0-9]{32}(\/control)?$/, /^devices\/[a-f0-9]{32}\/commands$/],
  PUT: [/^devices\/[a-f0-9]{32}\/grants$/],
  DELETE: [/^devices\/[a-f0-9]{32}$/, /^devices\/[a-f0-9]{32}\/viewers\/[a-f0-9]{32}(\/control)?$/],
};

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join("/");
  if (!routes[request.method]?.some((pattern) => pattern.test(path))) {
    return NextResponse.json({ error: { message: "Unknown remote-screen route" } }, { status: 404 });
  }
  if (request.method !== "GET") {
    // Next's internal URL can use HTTP behind the HTTPS reverse proxy. Trust
    // only the explicitly configured public origin, never forwarded headers.
    let publicOrigin: string;
    try {
      publicOrigin = new URL(process.env.VALK_PUBLIC_URL || request.url).origin;
    } catch {
      return NextResponse.json({ error: { message: "Invalid dashboard public URL" } }, { status: 503 });
    }
    if (request.headers.get("origin") !== publicOrigin) {
      return NextResponse.json({ error: { message: "Same-origin request required" } }, { status: 403 });
    }
  }
  if (!process.env.DASHBOARD_JWT_SECRET) {
    return NextResponse.json({ error: { message: "Dashboard bearer authentication must be configured" } }, { status: 503 });
  }
  return proxyDashboardRoute(request, `remote-screen/v1/${path}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };

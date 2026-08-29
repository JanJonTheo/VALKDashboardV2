import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import {
  createSessionToken,
  requireDashboardSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
  const session = await requireDashboardSession(undefined, true);
  const response = await flaskRequest(
    "account/change-password",
    request,
    session,
  );
  const payload = await response.text();
  const next = new NextResponse(payload, {
    status: response.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
  if (response.ok) {
    const token = await createSessionToken({
      userId: session.user.id,
      username: session.user.name,
      role: session.role,
      tenantId: session.tenant.id,
      sessionId: session.sessionId,
      mustChangePassword: false,
    });
    next.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }
  return next;
}

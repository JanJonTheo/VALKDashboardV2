import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { getDashboardSession } from "@/lib/session";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { flaskRequest } from "@/lib/flask";
import { getTenantAuth } from "@/lib/better-auth";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cross-origin sign-out is not allowed.",
        },
      },
      { status: 403 },
    );
  const session = await getDashboardSession();
  if (session) {
    await flaskRequest(
      "account/logout",
      new Request(request.url, { method: "POST", headers: request.headers }),
      session,
    ).catch(() => null);
  }
  const response = NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  if (session) {
    const auth = await getTenantAuth(session.tenant.id).catch(() => null);
    if (auth) {
      const signOut = await auth
        .handler(
          new Request(
            new URL(`/api/auth/${session.tenant.id}/sign-out`, request.url),
            { method: "POST", headers: request.headers },
          ),
        )
        .catch(() => null);
      if (signOut)
        for (const cookie of signOut.headers.getSetCookie())
          response.headers.append("set-cookie", cookie);
    }
  }
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.delete("valk_tenant");
  return response;
}

import { NextResponse } from "next/server";
import { createBetterAuthBridgeCookie } from "@/lib/better-auth";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { AccessError, requireDashboardSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Invalid request origin" } },
      { status: 403 },
    );
  try {
    const session = await requireDashboardSession("dashboard:read");
    if (!session.sessionId)
      return NextResponse.json(
        {
          error: {
            code: "SESSION_BRIDGE_UNAVAILABLE",
            message: "The tenant session cannot be linked",
          },
        },
        { status: 401 },
      );
    const bridgeCookie = await createBetterAuthBridgeCookie(
      session.tenant.id,
      session.user.id,
      session.sessionId,
    );
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(bridgeCookie.name, bridgeCookie.value, {
      httpOnly: true,
      secure: process.env.VALK_PUBLIC_URL?.startsWith("https://") === true,
      sameSite: "lax",
      path: "/",
      maxAge: bridgeCookie.maxAge,
    });
    return response;
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 401;
    return NextResponse.json(
      {
        error: {
          code: "SESSION_BRIDGE_UNAVAILABLE",
          message: "Sign in again before connecting a social provider",
        },
      },
      { status },
    );
  }
}

import "server-only";

import { NextResponse } from "next/server";
import type { Capability } from "./access";
import { flaskRequest } from "./flask";
import { AccessError, requireDashboardSession } from "./session";

export async function proxyDashboardRoute(
  request: Request,
  path: string,
  capability?: Capability,
) {
  try {
    const session = await requireDashboardSession(capability);
    const response = await flaskRequest(path, request, session);
    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-correlation-id":
          response.headers.get("x-correlation-id") ?? crypto.randomUUID(),
      },
    });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code:
            status === 401
              ? "UNAUTHENTICATED"
              : status === 403
                ? "FORBIDDEN"
                : "UPSTREAM_ERROR",
          message: error instanceof Error ? error.message : "Request failed",
        },
      },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}

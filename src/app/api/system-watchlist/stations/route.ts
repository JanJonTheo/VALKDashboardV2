import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

function errorResponse(error: unknown) {
  const status = error instanceof AccessError ? error.status : 502;
  return NextResponse.json(
    {
      error: {
        code:
          status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : "STATION_SOURCE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Station and settlement data is unavailable",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireDashboardSession();
    const system =
      new URL(request.url).searchParams.get("system")?.trim() ?? "";
    if (system.length < 2 || system.length > 255)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_SYSTEM",
            message: "A valid system name is required",
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );

    const response = await flaskRequest("system-facilities", request, session);
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "private, max-age=60",
        "x-valk-facility-source": "spansh-cache",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

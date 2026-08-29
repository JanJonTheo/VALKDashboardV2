import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { systemWatchlistSchema } from "@/lib/system-watchlist";

const preferenceKey = "bgs-system-watchlist";
const watchlistSchemaVersion = 2;

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
              : "WATCHLIST_ERROR",
        message:
          error instanceof Error ? error.message : "Watchlist request failed",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function proxyReadOrDelete(request: Request) {
  try {
    const session = await requireDashboardSession();
    const response = await flaskRequest(
      `dashboard/preferences/${preferenceKey}`,
      request,
      session,
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET(request: Request) {
  return proxyReadOrDelete(request);
}

export async function PUT(request: Request) {
  try {
    const session = await requireDashboardSession();
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16 * 1024)
      return NextResponse.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "The system watchlist exceeds 16 KB",
          },
        },
        { status: 413 },
      );
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "The system watchlist must be valid JSON",
          },
        },
        { status: 400 },
      );
    }
    const parsed = systemWatchlistSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_WATCHLIST",
            message: parsed.error.issues[0]?.message ?? "Invalid watchlist",
          },
        },
        { status: 400 },
      );
    const upstream = new Request(request.url, {
      method: "PUT",
      headers: request.headers,
      body: JSON.stringify({
        schema_version: watchlistSchemaVersion,
        payload: parsed.data,
      }),
    });
    const response = await flaskRequest(
      `dashboard/preferences/${preferenceKey}`,
      upstream,
      session,
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE(request: Request) {
  return proxyReadOrDelete(request);
}

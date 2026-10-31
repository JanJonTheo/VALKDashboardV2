import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { systemWatchlistSchema } from "@/lib/system-watchlist";

import { fetchWatchlistData } from "@/lib/watchlist-data";

const preferenceKey = "bgs-system-watchlist";

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
              : "WATCHLIST_DATA_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "System watchlist data is unavailable",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireDashboardSession();
    const preferenceResponse = await flaskRequest(
      `dashboard/preferences/${preferenceKey}`,
      new Request(request.url, { method: "GET", headers: request.headers }),
      session,
    );
    if (!preferenceResponse.ok)
      return new NextResponse(await preferenceResponse.text(), {
        status: preferenceResponse.status,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    const preference = (await preferenceResponse.json()) as {
      data?: { payload?: unknown } | null;
    };
    const parsed = systemWatchlistSchema.safeParse(
      preference.data?.payload ?? { systems: [] },
    );
    const watchlist = parsed.success ? parsed.data.systems : [];
    if (!watchlist.length)
      return NextResponse.json(
        {
          watchlist,
          data: [],
          generated_at: new Date().toISOString(),
        },
        { headers: { "cache-control": "no-store" } },
      );

    const response = await fetchWatchlistData(
      request,
      session,
      watchlist.map((entry) => entry.system),
    );
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return NextResponse.json(
      { ...(payload ?? {}), watchlist },
      {
        status: response.status,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

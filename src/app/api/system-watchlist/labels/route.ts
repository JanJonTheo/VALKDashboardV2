import { NextResponse } from "next/server";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { watchlistLabelsSchema } from "@/lib/watchlist-labels";
import { saveWatchlistLabels } from "@/lib/watchlist-labels-store";

export async function PUT(request: Request) {
  try {
    const session = await requireDashboardSession("tenant-rules:write");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096)
      return NextResponse.json(
        { error: { message: "Labels exceed 4 KB" } },
        { status: 413 },
      );
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: { message: "Labels must be valid JSON" } },
        { status: 400 },
      );
    }
    const parsed = watchlistLabelsSchema.safeParse(value);
    if (!parsed.success)
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message } },
        { status: 400 },
      );
    await saveWatchlistLabels(session.tenant.id, session.user.id, parsed.data);
    return NextResponse.json(
      { data: parsed.data },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Labels could not be saved",
        },
      },
      { status: error instanceof AccessError ? error.status : 502 },
    );
  }
}

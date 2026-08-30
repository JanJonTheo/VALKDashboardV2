import { NextResponse } from "next/server";
import { z } from "zod";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

const stateSchema = z.object({
  read: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  try {
    const session = await requireDashboardSession("dashboard:read");
    const parsed = stateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ALERT_STATE",
            message: "Invalid alert state",
          },
        },
        { status: 400 },
      );
    const { alertId } = await params;
    const upstream = new Request(request.url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const response = await flaskRequest(
      `dashboard/bgs/alerts/${encodeURIComponent(alertId)}/state`,
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
    const status = error instanceof AccessError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code:
            status === 401
              ? "UNAUTHENTICATED"
              : status === 403
                ? "FORBIDDEN"
                : "ALERT_STATE_ERROR",
          message:
            error instanceof Error ? error.message : "Alert update failed",
        },
      },
      { status },
    );
  }
}

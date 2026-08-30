import { NextResponse } from "next/server";
import { z } from "zod";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

const analysisSchema = z.object({
  system_name: z.string().trim().min(2).max(255),
  report_type: z.enum(["risk", "strategy"]),
});

function failure(error: unknown) {
  const status = error instanceof AccessError ? error.status : 502;
  return NextResponse.json(
    {
      error: {
        code:
          status === 401
            ? "UNAUTHENTICATED"
            : status === 403
              ? "FORBIDDEN"
              : "BGS_AI_ERROR",
        message:
          error instanceof Error ? error.message : "BGS AI request failed",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireDashboardSession("dashboard:read");
    const response = await flaskRequest(
      "dashboard/bgs/ai-reports",
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
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireDashboardSession("bgs-ai:run");
    const parsed = analysisSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_AI_REQUEST",
            message: parsed.error.issues[0]?.message ?? "Invalid AI request",
          },
        },
        { status: 400 },
      );
    const upstream = new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const response = await flaskRequest(
      "dashboard/bgs/ai-reports/analyze",
      upstream,
      session,
      120_000,
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

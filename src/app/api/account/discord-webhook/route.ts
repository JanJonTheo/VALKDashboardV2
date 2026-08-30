import { NextResponse } from "next/server";
import { z } from "zod";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

const payloadSchema = z.object({
  webhook_url: z.string().trim().url().max(2048),
});

async function forward(request: Request, body?: string) {
  const session = await requireDashboardSession("rules:write");
  const upstream = new Request(request.url, {
    method: request.method,
    headers: body ? { "content-type": "application/json" } : request.headers,
    body,
  });
  const response = await flaskRequest(
    "account/discord-webhook",
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
}

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
              : "WEBHOOK_ERROR",
        message:
          error instanceof Error ? error.message : "Webhook request failed",
      },
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    return await forward(request);
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = payloadSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_WEBHOOK",
            message: parsed.error.issues[0]?.message ?? "Invalid webhook",
          },
        },
        { status: 400 },
      );
    return await forward(request, JSON.stringify(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return await forward(request);
  } catch (error) {
    return failure(error);
  }
}

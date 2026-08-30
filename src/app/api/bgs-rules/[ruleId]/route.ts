import { NextResponse } from "next/server";
import { bgsRuleInputSchema } from "@/lib/bgs-rules";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

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
              : "BGS_RULE_ERROR",
        message:
          error instanceof Error ? error.message : "BGS rule request failed",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function forward(request: Request, ruleId: string, body?: string) {
  const session = await requireDashboardSession("rules:write");
  const upstream = new Request(request.url, {
    method: request.method,
    headers: body ? { "content-type": "application/json" } : request.headers,
    body,
  });
  const response = await flaskRequest(
    `dashboard/bgs/rules/${encodeURIComponent(ruleId)}`,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 32 * 1024)
      return NextResponse.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Rule payload exceeds 32 KB",
          },
        },
        { status: 413 },
      );
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Rule payload must be valid JSON",
          },
        },
        { status: 400 },
      );
    }
    const parsed = bgsRuleInputSchema.safeParse(value);
    if (!parsed.success)
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RULE",
            message: parsed.error.issues[0]?.message ?? "Invalid rule",
          },
        },
        { status: 400 },
      );
    const { ruleId } = await params;
    return await forward(request, ruleId, JSON.stringify(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { ruleId } = await params;
    return await forward(request, ruleId);
  } catch (error) {
    return failure(error);
  }
}

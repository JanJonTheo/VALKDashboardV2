import { NextResponse } from "next/server";
import { z } from "zod";
import { flaskRequest } from "@/lib/flask";
import {
  preferenceSchemaVersion,
  viewCollectionSchema,
  viewPreferenceSchema,
} from "@/lib/preferences";
import { AccessError, requireDashboardSession } from "@/lib/session";

const viewKeySchema = z.string().regex(/^[a-zA-Z0-9_.-]{1,96}$/);
const maximumPreferenceBytes = 16 * 1024;

function payloadTooLarge() {
  return NextResponse.json(
    {
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Saved views exceed the 16 KB storage limit. Remove a saved view or reduce its filters.",
      },
    },
    { status: 413 },
  );
}

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
              : "PREFERENCE_ERROR",
        message:
          error instanceof Error ? error.message : "Preference request failed",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

async function proxy(request: Request, params: Promise<{ viewKey: string }>) {
  try {
    const { viewKey: rawViewKey } = await params;
    const parsedKey = viewKeySchema.safeParse(rawViewKey);
    if (!parsedKey.success)
      return NextResponse.json(
        { error: { code: "INVALID_VIEW", message: "Invalid view key" } },
        { status: 400 },
      );
    const session = await requireDashboardSession();
    let upstream = request;
    if (request.method === "PUT") {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > maximumPreferenceBytes)
        return payloadTooLarge();
      const body = JSON.parse(raw) as unknown;
      const parsed =
        typeof body === "object" && body !== null && "current" in body
          ? viewCollectionSchema.safeParse(body)
          : viewPreferenceSchema.safeParse(body);
      if (!parsed.success)
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PREFERENCE",
              message: "The view preference is invalid",
            },
          },
          { status: 400 },
        );
      const payload = JSON.stringify({
        schema_version: preferenceSchemaVersion,
        payload: parsed.data,
      });
      // Flask applies its limit to the complete envelope, not just the view.
      if (new TextEncoder().encode(payload).length > maximumPreferenceBytes)
        return payloadTooLarge();
      upstream = new Request(request.url, {
        method: "PUT",
        headers: request.headers,
        body: payload,
      });
    }
    const response = await flaskRequest(
      `dashboard/preferences/${encodeURIComponent(parsedKey.data)}`,
      upstream,
      session,
    );
    const data = await response.text();
    return new NextResponse(data, {
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

type PreferenceRouteContext = { params: Promise<{ viewKey: string }> };
export function GET(request: Request, { params }: PreferenceRouteContext) {
  return proxy(request, params);
}

export function PUT(request: Request, { params }: PreferenceRouteContext) {
  return proxy(request, params);
}

export function DELETE(request: Request, { params }: PreferenceRouteContext) {
  return proxy(request, params);
}

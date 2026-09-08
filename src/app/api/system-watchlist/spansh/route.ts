import { NextResponse } from "next/server";
import { flaskRequest } from "@/lib/flask";
import { AccessError, requireDashboardSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const session = await requireDashboardSession();
    const system =
      new URL(request.url).searchParams.get("system")?.trim() ?? "";
    if (system.length < 2 || system.length > 255)
      return NextResponse.json(
        { error: { message: "A valid system name is required" } },
        { status: 400 },
      );
    const url = new URL(request.url);
    url.search = new URLSearchParams({ system }).toString();
    const response = await flaskRequest(
      "system-facilities",
      new Request(url),
      session,
    );
    const payload = await response.json();
    if (!response.ok)
      return NextResponse.json(payload, { status: response.status });
    const target = String(payload.data?.source_url ?? "");
    if (!/^https:\/\/spansh\.co\.uk\/system\/\d+$/.test(target))
      return NextResponse.json(
        {
          error: {
            message: "This system is not available in the Spansh index yet",
          },
        },
        { status: 404 },
      );
    return new NextResponse(null, {
      status: 302,
      headers: { location: target, "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Spansh could not be opened",
        },
      },
      { status: error instanceof AccessError ? error.status : 502 },
    );
  }
}

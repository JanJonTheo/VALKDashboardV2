import { NextResponse } from "next/server";
import { AccessError, requireDashboardSession } from "@/lib/session";

function errorResponse(error: unknown) {
  const status =
    error instanceof AccessError
      ? error.status
      : error instanceof DOMException && error.name === "TimeoutError"
        ? 504
        : 502;
  return NextResponse.json(
    {
      error: {
        code: status === 504 ? "EDGIS_MAP_TIMEOUT" : "EDGIS_MAP_ERROR",
        message:
          status === 504
            ? "The EDGIS system map took too long to render"
            : error instanceof Error
              ? error.message
              : "The EDGIS system map is unavailable",
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function GET(request: Request) {
  try {
    await requireDashboardSession();
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

    const base = process.env.FLASK_API_BASE_URL;
    if (!base) throw new Error("FLASK_API_BASE_URL is not configured");
    const url = new URL(
      `sysmap/${encodeURIComponent(system)}`,
      base.endsWith("/") ? base : `${base}/`,
    );
    url.searchParams.set("w", "1440");
    url.searchParams.set("h", "900");
    url.searchParams.set("full", "0");
    url.searchParams.set("r", "1");
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "image/png" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(
        `EDGIS map rendering failed with HTTP ${response.status}`,
      );
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") ?? "image/png",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

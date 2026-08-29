import { NextResponse } from "next/server";
import { getTenantConfigs } from "@/lib/tenant-config";

export async function GET() {
  const demo =
    process.env.VALK_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.VALK_DEMO_MODE !== "false");
  if (demo)
    return NextResponse.json({
      status: "ok",
      service: "valk-dashboard-v2",
      mode: "demo",
      version: process.env.npm_package_version ?? "0.1.0",
      generated_at: new Date().toISOString(),
    });
  try {
    const tenants = await getTenantConfigs();
    const ready =
      Boolean(process.env.FLASK_API_BASE_URL) &&
      tenants.length > 0 &&
      tenants.every((tenant) => tenant.hasDatabase);
    return NextResponse.json(
      {
        status: ready ? "ok" : "degraded",
        service: "valk-dashboard-v2",
        mode: "tenant-api",
        tenant_count: tenants.length,
        tenant_databases_configured: tenants.filter(
          (tenant) => tenant.hasDatabase,
        ).length,
        version: process.env.npm_package_version ?? "0.1.0",
        generated_at: new Date().toISOString(),
      },
      { status: ready ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "valk-dashboard-v2",
        mode: "tenant-api",
        version: process.env.npm_package_version ?? "0.1.0",
        generated_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

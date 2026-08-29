import { NextResponse } from "next/server";
import { requireDashboardSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await requireDashboardSession();
  const body = (await request.json().catch(() => null)) as {
    tenantId?: string;
  } | null;
  const tenant = session.availableTenants.find(
    (item) => item.id === body?.tenantId,
  );
  if (!tenant)
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Sign in to this tenant first.",
        },
      },
      { status: 403 },
    );
  return NextResponse.json({ ok: true, tenant });
}

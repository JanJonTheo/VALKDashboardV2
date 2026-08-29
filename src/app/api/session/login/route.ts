import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { getTenantById } from "@/lib/tenant-config";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { createBetterAuthBridgeCookie } from "@/lib/better-auth";

const inputSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(512),
  tenantId: z.string().trim().min(1).max(128),
});
const userSchema = z.object({
  id: z.union([z.string(), z.number()]),
  username: z.string(),
  is_admin: z.boolean(),
  role: z.enum(["member", "leadership", "admin"]),
  must_change_password: z.boolean().default(false),
  auth_email: z.string().email().nullish(),
  dashboard_session_id: z.string().uuid().nullish(),
  tenant_name: z.string(),
  faction_name: z.string().nullish(),
  faction_logo: z.string().nullish(),
});

function error(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code: status === 401 ? "INVALID_CREDENTIALS" : "SIGN_IN_FAILED",
        message,
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function loginEndpoint(): string {
  const base = process.env.FLASK_API_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("FLASK_API_BASE_URL is not configured");
  return base.endsWith("/api") ? `${base}/login` : `${base}/api/login`;
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request))
    return error("Cross-origin sign-in is not allowed.", 403);
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return error("Choose a tenant and enter username and password.", 400);
  try {
    const tenant = await getTenantById(parsed.data.tenantId);
    if (!tenant) return error("Invalid username, password or tenant.", 401);
    const upstream = await fetch(loginEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: tenant.apiKey,
        apiversion: tenant.apiVersion,
        "x-valk-dashboard-session": "1",
      },
      body: JSON.stringify({
        username: parsed.data.username,
        password: parsed.data.password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (upstream.status === 401 || upstream.status === 400)
      return error("Invalid username, password or tenant.", 401);
    if (!upstream.ok)
      return error(
        "The tenant service is currently unavailable. Please try again.",
        502,
      );
    const user = userSchema.safeParse(await upstream.json());
    if (!user.success || user.data.tenant_name !== tenant.name)
      return error("The tenant response could not be verified.", 502);
    if (!user.data.dashboard_session_id)
      return error("The tenant session could not be created.", 502);
    const token = await createSessionToken({
      userId: String(user.data.id),
      username: user.data.username,
      role: user.data.role,
      tenantId: tenant.id,
      sessionId: user.data.dashboard_session_id,
      mustChangePassword: user.data.must_change_password,
    });
    const response = NextResponse.json(
      {
        ok: true,
        tenant: { id: tenant.id, name: tenant.name },
        role: user.data.role,
        mustChangePassword: user.data.must_change_password,
      },
      { headers: { "cache-control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    if (user.data.auth_email) {
      const bridgeCookie = await createBetterAuthBridgeCookie(
        tenant.id,
        String(user.data.id),
        user.data.dashboard_session_id,
      ).catch(() => null);
      if (bridgeCookie)
        response.cookies.set(bridgeCookie.name, bridgeCookie.value, {
          httpOnly: true,
          secure: process.env.VALK_PUBLIC_URL?.startsWith("https://") === true,
          sameSite: "lax",
          path: "/",
          maxAge: bridgeCookie.maxAge,
        });
    }
    response.cookies.delete("valk_tenant");
    return response;
  } catch {
    return error(
      "The sign-in service is currently unavailable. Please try again.",
      503,
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getTenantAuth, socialAuthConfigured } from "@/lib/better-auth";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { publicAppUrl } from "@/lib/public-app-url";
import { getTenantById } from "@/lib/tenant-config";

const roleSchema = z.enum(["member", "leadership", "admin"]);

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId") ?? "";
  const tenant = await getTenantById(tenantId);
  if (!tenant || !socialAuthConfigured())
    return NextResponse.redirect(
      publicAppUrl("/sign-in?error=social-unavailable", request.url),
    );
  const auth = await getTenantAuth(tenantId);
  const socialSession = await auth.api.getSession({ headers: request.headers });
  if (!socialSession)
    return NextResponse.redirect(
      publicAppUrl("/sign-in?error=social-account-not-linked", request.url),
    );
  const user = socialSession.user as typeof socialSession.user & {
    role?: unknown;
    active?: unknown;
    mustChangePassword?: unknown;
  };
  const role = roleSchema.safeParse(user.role);
  if (!role.success || user.active !== true)
    return NextResponse.redirect(
      publicAppUrl("/sign-in?error=account-inactive", request.url),
    );
  const token = await createSessionToken({
    userId: String(user.id),
    username: user.name,
    role: role.data,
    tenantId,
    sessionId: socialSession.session.id,
    mustChangePassword: user.mustChangePassword === true,
  });
  const response = NextResponse.redirect(publicAppUrl("/", request.url));
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}

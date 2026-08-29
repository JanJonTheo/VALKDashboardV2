import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import {
  capabilitiesFor,
  roles,
  type Capability,
  type DashboardSession,
  type Role,
} from "./access";
import { getTenantById, type FlaskTenantConfig } from "./tenant-config";

export const SESSION_COOKIE = "valk_dashboard_session";
export const SESSION_SECONDS = 12 * 60 * 60;
const issuer = "valk-dashboard-v2";
const audience = "valk-dashboard";

interface LegacySessionInput {
  userId: string;
  username: string;
  role: Role;
  tenantId: string;
  sessionId?: string | null;
  mustChangePassword: boolean;
}

function demoEnabled() {
  return (
    process.env.VALK_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" &&
      process.env.VALK_DEMO_MODE !== "false")
  );
}

function sessionKey(): Uint8Array {
  const secret = process.env.VALK_SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production")
    throw new Error("VALK_SESSION_SECRET is not configured");
  return new TextEncoder().encode(
    secret ?? "local-development-session-secret-change-me",
  );
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

function sessionFor(
  user: { id: string; name: string },
  tenant: FlaskTenantConfig,
  role: Role,
  verifiedAt: string,
  sessionId: string | undefined,
  mustChangePassword: boolean,
): DashboardSession {
  const tenantView = {
    id: tenant.id,
    name: tenant.name,
    factionName: tenant.factionName,
    logoUrl: "/api/tenant-logo",
  };
  return {
    user,
    tenant: tenantView,
    role,
    capabilities: capabilitiesFor(role),
    availableTenants: [tenantView],
    verifiedAt,
    sessionId,
    mustChangePassword,
  };
}

export async function createSessionToken(
  input: LegacySessionInput,
): Promise<string> {
  const verifiedAt = new Date().toISOString();
  return new SignJWT({
    username: input.username,
    tenantId: input.tenantId,
    role: input.role,
    verifiedAt,
    sid: input.sessionId ?? undefined,
    mustChangePassword: input.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionKey());
}

export function sessionCookieOptions() {
  const configured = process.env.VALK_COOKIE_SECURE?.toLowerCase();
  const secure = configured
    ? configured === "true"
    : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high" as const,
  };
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  if (demoEnabled()) {
    const role = isRole(process.env.VALK_DEMO_ROLE)
      ? process.env.VALK_DEMO_ROLE
      : "admin";
    const tenant = {
      id: "valk",
      name: "VALK Squadron",
      factionName: "Valkyrie Galactic Security Executive",
      logoUrl: undefined,
    };
    return {
      user: { id: "demo-user", name: "Valkyrie" },
      tenant,
      role,
      capabilities: capabilitiesFor(role),
      availableTenants: [tenant],
      verifiedAt: new Date().toISOString(),
      mustChangePassword: false,
    };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    if (
      !payload.sub ||
      typeof payload.username !== "string" ||
      typeof payload.tenantId !== "string" ||
      !isRole(payload.role)
    )
      return null;
    const tenant = await getTenantById(payload.tenantId);
    if (!tenant) return null;
    return sessionFor(
      { id: payload.sub, name: payload.username },
      tenant,
      payload.role,
      typeof payload.verifiedAt === "string"
        ? payload.verifiedAt
        : new Date().toISOString(),
      typeof payload.sid === "string" ? payload.sid : undefined,
      payload.mustChangePassword === true,
    );
  } catch {
    return null;
  }
}

export async function requireDashboardSession(
  capability?: Capability,
  allowPasswordChangeRequired = false,
): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (!session) throw new AccessError(401, "Authentication required");
  if (session.mustChangePassword && !allowPasswordChangeRequired)
    throw new AccessError(
      403,
      "Change your one-time password before using the dashboard",
    );
  if (capability && !session.capabilities.includes(capability))
    throw new AccessError(
      403,
      "Your dashboard account does not grant that capability",
    );
  return session;
}

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

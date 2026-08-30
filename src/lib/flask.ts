import "server-only";

import { SignJWT } from "jose";
import type { DashboardSession } from "./access";
import { getTenantById } from "./tenant-config";

export async function flaskRequest(
  path: string,
  request: Request,
  session: DashboardSession,
  timeoutMs = 20_000,
): Promise<Response> {
  const base = process.env.FLASK_API_BASE_URL;
  if (!base) throw new Error("FLASK_API_BASE_URL is not configured");
  const tenant = await getTenantById(session.tenant.id);
  if (!tenant) throw new Error("The selected tenant is no longer configured");
  const correlation =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const headers = new Headers({
    accept: "application/json",
    "x-correlation-id": correlation,
  });
  const jwtSecret = process.env.DASHBOARD_JWT_SECRET;
  if (jwtSecret) {
    const token = await new SignJWT({
      tenant_id: session.tenant.id,
      role: session.role,
      capabilities: session.capabilities,
      jti: crypto.randomUUID(),
      sid: session.sessionId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(session.user.id)
      .setAudience("valk-api")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(jwtSecret));
    headers.set("authorization", `Bearer ${token}`);
  } else {
    headers.set("apikey", tenant.apiKey);
    headers.set("apiversion", tenant.apiVersion);
  }
  const url = new URL(
    path.replace(/^\//, ""),
    base.endsWith("/") ? base : `${base}/`,
  );
  const incoming = new URL(request.url);
  incoming.searchParams.forEach((value, key) =>
    url.searchParams.append(key, value),
  );
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
  if (body) {
    headers.set(
      "content-type",
      request.headers.get("content-type") ?? "application/json",
    );
  }
  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const responseHeaders = new Headers({
    "content-type": "application/json",
    "x-correlation-id": correlation,
  });
  const raw = (await response
    .json()
    .catch(() => ({ error: "Invalid JSON response from Flask" }))) as unknown;
  if (request.method === "GET" && response.ok) {
    const generated_at = new Date().toISOString();
    if (Array.isArray(raw))
      return Response.json(
        {
          data: raw,
          metrics: {},
          generated_at,
          pagination: {
            page: Number(incoming.searchParams.get("page") ?? 1),
            page_size: Number(incoming.searchParams.get("page_size") ?? 25),
            total: raw.length,
          },
        },
        { status: response.status, headers: responseHeaders },
      );
    if (raw && typeof raw === "object")
      return Response.json(
        { ...raw, generated_at },
        { status: response.status, headers: responseHeaders },
      );
  }
  return Response.json(raw, {
    status: response.status,
    headers: responseHeaders,
  });
}

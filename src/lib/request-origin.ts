export function isAllowedRequestOrigin(request: Request): boolean {
  const value = request.headers.get("origin");
  if (!value) return true;

  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    return false;
  }

  const configured = process.env.VALK_PUBLIC_URL;
  if (configured) {
    try {
      if (origin.origin === new URL(configured).origin) return true;
    } catch {
      // Ignore an invalid optional public URL and fall back to the request host.
    }
  }

  const host = request.headers.get("host")?.trim();
  if (!host || origin.host !== host) return false;
  try {
    return origin.protocol === new URL(request.url).protocol;
  } catch {
    return false;
  }
}

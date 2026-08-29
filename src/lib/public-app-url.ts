function configuredOrigin(requestUrl: string, configuredPublicUrl?: string) {
  if (configuredPublicUrl?.trim()) {
    try {
      return new URL(configuredPublicUrl).origin;
    } catch {
      // Fall back to the request origin when deployment configuration is invalid.
    }
  }
  return new URL(requestUrl).origin;
}

export function publicAppUrl(
  path: string,
  requestUrl: string,
  configuredPublicUrl = process.env.VALK_PUBLIC_URL,
) {
  return new URL(path, `${configuredOrigin(requestUrl, configuredPublicUrl)}/`);
}

function isLoopback(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function normalizedOAuthLocation(
  location: string,
  requestUrl: string,
  configuredPublicUrl = process.env.VALK_PUBLIC_URL,
) {
  const target = new URL(location, requestUrl);
  const isRelative = location.startsWith("/");

  if (!isRelative && !isLoopback(target.hostname)) return target;

  return publicAppUrl(
    `${target.pathname}${target.search}${target.hash}`,
    requestUrl,
    configuredPublicUrl,
  );
}

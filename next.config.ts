import type { NextConfig } from "next";

const scriptSource = process.env.NODE_ENV === "production"
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const remoteMedia = process.env.REMOTE_LIVEKIT_URL ? new URL(process.env.REMOTE_LIVEKIT_URL) : null;
if (remoteMedia && (remoteMedia.protocol !== "wss:" || remoteMedia.username || remoteMedia.password)) {
  throw new Error("REMOTE_LIVEKIT_URL must be a secure WebSocket origin");
}
const remoteConnect = remoteMedia ? ` ${remoteMedia.origin} ${remoteMedia.origin.replace(/^wss:/, "https:")}` : "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [{ source:"/(.*)", headers:[
      {key:"X-Content-Type-Options",value:"nosniff"},
      {key:"X-Frame-Options",value:"DENY"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
      {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"Content-Security-Policy",value:`default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'${remoteConnect}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`},
    ]}];
  },
};

export default nextConfig;

import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { AccessError, requireDashboardSession } from "@/lib/session";
import { configuredTenantFilePath, getTenantById } from "@/lib/tenant-config";

const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET() {
  try {
    const session = await requireDashboardSession(undefined, true);
    const tenant = await getTenantById(session.tenant.id);
    if (!tenant) return new Response(null, { status: 404 });
    const fileName = basename(tenant.factionLogo);
    const mime = mimeTypes[extname(fileName).toLowerCase()];
    if (!mime) return new Response(null, { status: 404 });
    const directories = [
      process.env.VALK_TENANT_LOGO_DIR,
      join(dirname(configuredTenantFilePath()), "assets"),
    ].filter((value): value is string => Boolean(value));
    for (const directory of directories) {
      try {
        const data = await readFile(join(directory, fileName));
        return new Response(new Uint8Array(data), {
          headers: {
            "content-type": mime,
            "cache-control": "private, max-age=3600",
            "x-content-type-options": "nosniff",
          },
        });
      } catch {
        // Try the next configured asset directory.
      }
    }
    return new Response(null, { status: 404 });
  } catch (cause) {
    return new Response(null, {
      status: cause instanceof AccessError ? cause.status : 500,
    });
  }
}

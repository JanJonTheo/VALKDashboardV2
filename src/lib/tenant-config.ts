import "server-only";

import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

const tenantSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  api_key: z.string().min(1),
  api_version: z.union([z.string(), z.number()]).optional(),
  db_uri: z.string().optional(),
  faction_name: z.string().trim().optional(),
  faction_logo: z.string().trim().optional(),
});

export interface FlaskTenantConfig {
  id: string;
  name: string;
  apiKey: string;
  apiVersion: string;
  factionName: string;
  factionLogo: string;
  hasDatabase: boolean;
  databaseUri?: string;
  databasePath?: string;
}

let cached:
  | { path: string; mtimeMs: number; tenants: readonly FlaskTenantConfig[] }
  | undefined;

function tenantFilePath(): string {
  const configured = process.env.VALK_TENANT_FILE?.trim();
  if (!configured) throw new Error("VALK_TENANT_FILE is not configured");
  return configured;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rawTenantValues(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (Array.isArray(record.tenants)) return record.tenants;
  return Object.values(record);
}

function databasePath(uri: string | undefined, configPath: string) {
  if (!uri?.startsWith("sqlite:///")) return undefined;
  const raw = decodeURIComponent(uri.slice("sqlite:///".length));
  const configuredRoot = process.env.VALK_TENANT_DB_ROOT?.trim();
  return isAbsolute(raw)
    ? raw
    : resolve(configuredRoot || dirname(configPath), raw);
}

function parseTenants(
  raw: string,
  configPath: string,
): readonly FlaskTenantConfig[] {
  const parsed = JSON.parse(raw) as unknown;
  const tenants = rawTenantValues(parsed).map((value, index) => {
    const tenant = tenantSchema.parse(value);
    const tenantId = tenant.id ?? slug(tenant.name) ?? `tenant-${index + 1}`;
    return {
      id: tenantId,
      name: tenant.name,
      apiKey: tenant.api_key,
      apiVersion: String(
        tenant.api_version ?? process.env.FLASK_API_VERSION ?? "1.8.0",
      ),
      factionName: tenant.faction_name || tenant.name,
      factionLogo: tenant.faction_logo || "/assets/VALT_logo.jpg",
      hasDatabase: Boolean(tenant.db_uri),
      databaseUri: tenant.db_uri,
      databasePath: databasePath(tenant.db_uri, configPath),
    } satisfies FlaskTenantConfig;
  });

  if (!tenants.length) throw new Error("The tenant configuration is empty");
  const ids = new Set(tenants.map((tenant) => tenant.id));
  if (ids.size !== tenants.length) throw new Error("Tenant IDs must be unique");
  return tenants;
}

export async function getTenantConfigs(): Promise<
  readonly FlaskTenantConfig[]
> {
  const path = tenantFilePath();
  const file = await stat(path);
  if (cached?.path === path && cached.mtimeMs === file.mtimeMs)
    return cached.tenants;
  const tenants = parseTenants(await readFile(path, "utf8"), path);
  cached = { path, mtimeMs: file.mtimeMs, tenants };
  return tenants;
}

export async function getTenantById(
  id: string,
): Promise<FlaskTenantConfig | null> {
  return (await getTenantConfigs()).find((tenant) => tenant.id === id) ?? null;
}

export function configuredTenantFilePath(): string {
  return tenantFilePath();
}

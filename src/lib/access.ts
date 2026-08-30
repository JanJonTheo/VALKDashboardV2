export const roles = ["member", "leadership", "admin"] as const;
export type Role = (typeof roles)[number];

export const capabilities = [
  "dashboard:read",
  "rules:write",
  "tenant-rules:write",
  "bgs-ai:run",
  "objectives:write",
  "reports:send",
  "assessment:run",
  "admin:read",
  "users:read",
  "users:manage",
] as const;
export type Capability = (typeof capabilities)[number];

const grants: Record<Role, readonly Capability[]> = {
  member: ["dashboard:read", "rules:write"],
  leadership: [
    "dashboard:read",
    "rules:write",
    "tenant-rules:write",
    "bgs-ai:run",
    "objectives:write",
    "reports:send",
    "assessment:run",
  ],
  admin: capabilities,
};

export function capabilitiesFor(role: Role): readonly Capability[] {
  return grants[role];
}

export function can(role: Role, capability: Capability): boolean {
  return grants[role].includes(capability);
}

export function highestRole(
  discordRoleIds: readonly string[],
  roleMap: TenantRoleMap,
): Role | null {
  if (roleMap.admin.some((id) => discordRoleIds.includes(id))) return "admin";
  if (roleMap.leadership.some((id) => discordRoleIds.includes(id)))
    return "leadership";
  if (roleMap.member.some((id) => discordRoleIds.includes(id))) return "member";
  return null;
}

export interface TenantRoleMap {
  admin: string[];
  leadership: string[];
  member: string[];
}

export interface TenantAccessConfig {
  id: string;
  name: string;
  guildId: string;
  roles: TenantRoleMap;
}

export interface DashboardSession {
  user: { id: string; name: string; image?: string | null };
  tenant: { id: string; name: string; factionName?: string; logoUrl?: string };
  role: Role;
  capabilities: readonly Capability[];
  availableTenants: {
    id: string;
    name: string;
    factionName?: string;
    logoUrl?: string;
  }[];
  verifiedAt: string;
  sessionId?: string;
  mustChangePassword: boolean;
}

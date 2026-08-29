export const LOGIN_TENANT_COOKIE = "valk_login_tenant";
export const DEFAULT_LOGIN_TENANT_ID = "valk-development";

export function resolveLoginTenantId(
  tenantIds: readonly string[],
  savedTenantId?: string,
): string {
  if (savedTenantId && tenantIds.includes(savedTenantId)) return savedTenantId;
  if (tenantIds.includes(DEFAULT_LOGIN_TENANT_ID))
    return DEFAULT_LOGIN_TENANT_ID;
  return tenantIds[0] ?? "";
}

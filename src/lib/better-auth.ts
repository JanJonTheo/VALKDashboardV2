import "server-only";

import { createHmac } from "node:crypto";
import Database from "better-sqlite3";
import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { getCookies } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { getTenantById, type FlaskTenantConfig } from "./tenant-config";

function publicUrl() {
  return (
    process.env.VALK_PUBLIC_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
  );
}

function providerConfig() {
  const google =
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            scope: ["openid", "profile", "email"],
            disableSignUp: true,
            disableImplicitSignUp: true,
          },
        }
      : {};
  const discord =
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            scope: ["identify", "email"],
            disableSignUp: true,
            disableImplicitSignUp: true,
          },
        }
      : {};
  return { ...google, ...discord };
}

export function configuredSocialProviders(): Array<"google" | "discord"> {
  const configured = providerConfig();
  return (["google", "discord"] as const).filter(
    (provider) => provider in configured,
  );
}

export function socialAuthConfigured() {
  return (
    process.env.VALK_SOCIAL_AUTH_ENABLED === "true" &&
    configuredSocialProviders().length > 0
  );
}

function buildAuth(tenant: FlaskTenantConfig) {
  if (!tenant.databasePath)
    throw new Error(`Tenant ${tenant.id} does not use a local SQLite database`);
  const database = new Database(tenant.databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  const socialProviders = socialAuthConfigured() ? providerConfig() : {};
  return betterAuth({
    appName: `VALK Dashboard · ${tenant.name}`,
    baseURL: publicUrl(),
    basePath: `/api/auth/${tenant.id}`,
    secret: process.env.BETTER_AUTH_SECRET ?? process.env.VALK_SESSION_SECRET,
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      password: {
        hash: async (password) => hash(password, 12),
        verify: async ({ hash: passwordHash, password }) =>
          compare(password, passwordHash),
      },
    },
    socialProviders,
    user: {
      modelName: "users",
      validateUserInfo: async ({ user, source }) => {
        const provider = source.oauth?.providerId;
        if (
          source.method === "oauth" &&
          (provider === "discord" || provider === "google") &&
          (source.action === "link-account" || source.action === "sign-in") &&
          (user.emailVerified !== true ||
            typeof user.email !== "string" ||
            !user.email.trim())
        ) {
          return {
            error: "provider_email_not_verified",
            errorDescription:
              "The social provider must supply a verified email address.",
          };
        }
      },
      fields: {
        name: "username",
        email: "auth_email",
        emailVerified: "auth_email_verified",
        image: "auth_image",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        role: {
          type: "string",
          required: true,
          input: false,
          defaultValue: "member",
          fieldName: "role",
        },
        active: {
          type: "boolean",
          required: true,
          input: false,
          defaultValue: true,
          fieldName: "active",
        },
        mustChangePassword: {
          type: "boolean",
          required: true,
          input: false,
          defaultValue: false,
          fieldName: "must_change_password",
        },
      },
    },
    session: {
      modelName: "dashboard_session",
      expiresIn: 12 * 60 * 60,
      updateAge: 15 * 60,
      freshAge: 15 * 60,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "dashboard_account",
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        allowUnlinkingAll: true,
        updateUserInfoOnLink: false,
      },
    },
    verification: {
      modelName: "dashboard_verification",
      storeIdentifier: "hashed",
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "dashboard_rate_limit",
      window: 60,
      max: 30,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = database
              .prepare("SELECT active FROM users WHERE id = ?")
              .get(session.userId) as { active?: number } | undefined;
            if (!user?.active) return false;
          },
        },
      },
    },
    advanced: {
      cookiePrefix: `valk-${tenant.id}`,
      useSecureCookies: publicUrl().startsWith("https://"),
      database: { generateId: "uuid" },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: publicUrl().startsWith("https://"),
        sameSite: "lax",
      },
    },
    plugins: [nextCookies()],
  });
}

type TenantAuth = ReturnType<typeof buildAuth>;
const authCache = new Map<string, TenantAuth>();

export async function getTenantAuth(tenantId: string): Promise<TenantAuth> {
  const existing = authCache.get(tenantId);
  if (existing) return existing;
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error("Unknown dashboard tenant");
  const auth = buildAuth(tenant);
  authCache.set(tenantId, auth);
  return auth;
}

export async function createBetterAuthBridgeCookie(
  tenantId: string,
  userId: string,
  sessionId: string,
) {
  const auth = await getTenantAuth(tenantId);
  const tenant = await getTenantById(tenantId);
  if (!tenant?.databasePath)
    throw new Error("The tenant identity database is unavailable");
  const database = new Database(tenant.databasePath, { readonly: true });
  let row: { token: string; expiresAt: string } | undefined;
  try {
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 5000");
    row = database
      .prepare(
        "SELECT s.token, s.expiresAt FROM dashboard_session s " +
          "JOIN users u ON u.id = s.userId " +
          "WHERE s.id = ? AND CAST(s.userId AS TEXT) = ? AND u.active = 1",
      )
      .get(sessionId, userId) as
      | { token: string; expiresAt: string }
      | undefined;
  } finally {
    database.close();
  }
  if (
    !row?.token ||
    !row.expiresAt ||
    new Date(row.expiresAt).getTime() <= Date.now()
  )
    throw new Error("The verified tenant session is unavailable");
  const secret =
    process.env.BETTER_AUTH_SECRET ?? process.env.VALK_SESSION_SECRET;
  if (!secret) throw new Error("The Better Auth secret is unavailable");
  const signature = createHmac("sha256", secret)
    .update(row.token)
    .digest("base64");
  return {
    name: getCookies(auth.options).sessionToken.name,
    value: `${row.token}.${signature}`,
    maxAge: Math.max(
      1,
      Math.min(
        12 * 60 * 60,
        Math.floor((new Date(row.expiresAt).getTime() - Date.now()) / 1000),
      ),
    ),
  };
}

type LinkedSocialProvider = "discord" | "google";

interface VerifiedSocialProfile {
  accountId: string;
  email: string;
  image: string | null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function fetchVerifiedSocialProfile(
  provider: LinkedSocialProvider,
  accessToken: string,
): Promise<VerifiedSocialProfile> {
  const endpoint =
    provider === "discord"
      ? "https://discord.com/api/users/@me"
      : "https://openidconnect.googleapis.com/v1/userinfo";
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error("The linked provider profile is unavailable");
  const profile = (await response.json()) as Record<string, unknown>;
  const email = stringValue(profile.email).toLowerCase();
  const verified =
    provider === "discord"
      ? profile.verified === true
      : profile.email_verified === true;
  if (!email || !verified)
    throw new Error("The linked provider email is not verified");

  let image = stringValue(profile.picture) || stringValue(profile.image_url);
  const accountId = stringValue(profile.id ?? profile.sub);
  if (provider === "discord" && !image && accountId) {
    const avatar = stringValue(profile.avatar);
    if (avatar) {
      const format = avatar.startsWith("a_") ? "gif" : "png";
      image = `https://cdn.discordapp.com/avatars/${accountId}/${avatar}.${format}`;
    }
  }
  if (!accountId)
    throw new Error("The linked provider account has no stable ID");
  return { accountId, email, image: image || null };
}

export async function syncLinkedSocialProfile(
  tenantId: string,
  provider: LinkedSocialProvider,
  incoming: Request,
) {
  const auth = await getTenantAuth(tenantId);
  const session = await auth.api.getSession({ headers: incoming.headers });
  if (!session) return false;
  const accounts = await auth.api.listUserAccounts({
    headers: incoming.headers,
  });
  const account = accounts.find((item) => item.providerId === provider);
  if (!account) return false;
  const token = await auth.api.getAccessToken({
    body: { accountId: account.id },
    headers: incoming.headers,
  });
  const profile = await fetchVerifiedSocialProfile(provider, token.accessToken);
  if (profile.accountId !== account.accountId)
    throw new Error("The provider identity changed during account linking");

  const tenant = await getTenantById(tenantId);
  if (!tenant?.databasePath)
    throw new Error("The tenant identity database is unavailable");
  const database = new Database(tenant.databasePath);
  try {
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 5000");
    const result = database
      .prepare(
        "UPDATE users SET auth_email = ?, auth_email_verified = 1, auth_image = ?, updated_at = ? WHERE id = ? AND active = 1",
      )
      .run(
        profile.email,
        profile.image,
        new Date().toISOString(),
        session.user.id,
      );
    if (result.changes !== 1)
      throw new Error("The tenant user is no longer active");
  } finally {
    database.close();
  }
  return true;
}

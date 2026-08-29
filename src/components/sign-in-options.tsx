"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createAuthClient } from "better-auth/react";
import {
  Building2,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { LOGIN_TENANT_COOKIE } from "@/lib/login-preference";

const schema = z.object({
  tenantId: z.string().trim().min(1, "Choose a tenant").max(128),
  username: z.string().trim().min(1, "Enter your username").max(128),
  password: z.string().min(1, "Enter your password").max(512),
});

type Values = z.infer<typeof schema>;

export function SignInOptions({
  tenants,
  defaultTenantId,
  discordEnabled,
}: {
  tenants: { id: string; name: string }[];
  defaultTenantId: string;
  discordEnabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [socialPending, setSocialPending] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantId: defaultTenantId,
      username: "",
      password: "",
    },
  });
  const tenantId = useWatch({ control, name: "tenantId" });
  const authClient = useMemo(
    () => createAuthClient({ basePath: `/api/auth/${tenantId}` }),
    [tenantId],
  );

  const submitCredentials = handleSubmit(async (values) => {
    setMessage(undefined);
    const response = await fetch("/api/session/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setMessage(
        payload?.error?.message ?? "Sign-in failed. Please try again.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  });

  async function signInWithDiscord() {
    setMessage(undefined);
    if (!tenantId) {
      setMessage("Choose a tenant before continuing with Discord.");
      return;
    }
    if (!discordEnabled) {
      setMessage("Discord sign-in is currently unavailable.");
      return;
    }
    setSocialPending(true);
    try {
      const callbackURL = new URL(
        `/api/session/social-complete?tenantId=${encodeURIComponent(tenantId)}`,
        window.location.origin,
      ).toString();
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
      });
      if (result.error)
        setMessage(result.error.message ?? "Discord sign-in failed.");
    } catch {
      setMessage("Discord sign-in failed. Please try again.");
    } finally {
      setSocialPending(false);
    }
  }

  const pending = isSubmitting || socialPending;
  const tenantField = register("tenantId");

  function rememberTenant(tenant: string) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOGIN_TENANT_COOKIE}=${encodeURIComponent(tenant)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  return (
    <form className="sign-in-options" onSubmit={submitCredentials} noValidate>
      <label htmlFor="tenantId">Tenant</label>
      <div className="login-field login-select">
        <Building2 size={16} />
        <select
          id="tenantId"
          {...tenantField}
          onChange={(event) => {
            void tenantField.onChange(event);
            rememberTenant(event.target.value);
          }}
        >
          {tenants.map((tenant) => (
            <option value={tenant.id} key={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>
      {errors.tenantId && (
        <span className="field-error">{errors.tenantId.message}</span>
      )}

      <label htmlFor="username">Username</label>
      <div className="login-field">
        <UserRound size={16} />
        <input
          id="username"
          autoComplete="username"
          {...register("username")}
        />
      </div>
      {errors.username && (
        <span className="field-error">{errors.username.message}</span>
      )}

      <label htmlFor="password">Password</label>
      <div className="login-field">
        <LockKeyhole size={16} />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
      </div>
      {errors.password && (
        <span className="field-error">{errors.password.message}</span>
      )}

      {message && (
        <p className="login-error" role="alert">
          {message}
        </p>
      )}

      <div className="login-actions" aria-label="Sign-in options">
        <button
          className="login-method-button credentials-login-button"
          type="submit"
          disabled={pending}
        >
          {isSubmitting ? (
            <LoaderCircle className="spin" size={19} />
          ) : (
            <ShieldCheck size={19} />
          )}
          Login with Credentials
        </button>
        <button
          className="login-method-button discord-login-button"
          type="button"
          disabled={pending || !discordEnabled}
          onClick={() => void signInWithDiscord()}
          title={
            discordEnabled
              ? undefined
              : "Discord sign-in is currently unavailable"
          }
        >
          {socialPending ? (
            <LoaderCircle className="spin" size={19} />
          ) : (
            <MessageCircle size={19} />
          )}
          Login with Discord
        </button>
      </div>

      <div className="sign-in-points">
        <span>
          <ShieldCheck size={16} />
          Credentials are verified by the selected tenant service
        </span>
        <span>
          <CheckCircle2 size={16} />
          Tenant API keys remain securely on the server
        </span>
      </div>
      <small className="social-link-note">
        Discord sign-in requires an account linked previously in Your Profile.
      </small>
    </form>
  );
}

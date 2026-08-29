"use client";

import { Link2, ShieldCheck } from "lucide-react";
import { createAuthClient } from "better-auth/react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardSession } from "@/lib/access";
import { PasswordChangeCard } from "./password-change-card";

export function AccountProfile({
  session,
  providers,
}: {
  session: DashboardSession;
  providers: Array<"google" | "discord">;
}) {
  const oauthEnabled = providers.length > 0;
  const authClient = useMemo(
    () => createAuthClient({ basePath: `/api/auth/${session.tenant.id}` }),
    [session.tenant.id],
  );
  const [linked, setLinked] = useState<
    Array<{ providerId: string; accountId: string }>
  >([]);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!oauthEnabled) return;
    const syncErrorTimer =
      new URLSearchParams(window.location.search).get("socialError") ===
      "profile-sync-failed"
        ? window.setTimeout(
            () =>
              setError(
                "The provider was linked, but its verified profile could not be stored. Please disconnect it and try again.",
              ),
            0,
          )
        : undefined;
    void fetch("/api/session/social-bridge", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Social session unavailable");
        return authClient.listAccounts();
      })
      .then(({ data }) =>
        setLinked(
          (data ?? [])
            .filter((account) => account.providerId !== "credential")
            .map(({ providerId, accountId }) => ({ providerId, accountId })),
        ),
      )
      .catch(() =>
        setError("Sign in again before connecting a social provider."),
      );
    void fetch("/api/account/access", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const email = payload?.user?.auth_email;
        if (
          typeof email === "string" &&
          !email.toLowerCase().endsWith("@tenant.invalid")
        )
          setVerifiedEmail(email);
      });
    return () => {
      if (syncErrorTimer !== undefined) window.clearTimeout(syncErrorTimer);
    };
  }, [authClient, oauthEnabled]);

  async function connect(provider: "google" | "discord") {
    setError("");
    const bridge = await fetch("/api/session/social-bridge", {
      method: "POST",
    });
    if (!bridge.ok) {
      setError("Sign in again before connecting a social provider.");
      return;
    }
    const result = await authClient.linkSocial({
      provider,
      callbackURL: new URL("/account", window.location.origin).toString(),
    });
    if (result.error)
      setError(result.error.message ?? "Provider linking failed");
  }

  async function disconnect(provider: "google" | "discord") {
    setError("");
    const account = linked.find((item) => item.providerId === provider);
    if (!account) return;
    const result = await authClient.unlinkAccount({
      accountId: account.accountId,
    });
    if (result.error)
      setError(result.error.message ?? "Provider unlinking failed");
    else
      setLinked((current) =>
        current.filter((item) => item.providerId !== provider),
      );
  }
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">ACCOUNT / PROFILE</p>
          <h1>Your profile</h1>
          <p>
            Tenant-local credentials, role and explicitly linked social
            accounts.
          </p>
        </div>
      </header>
      <div className="account-grid">
        <section className="surface profile-summary">
          <ShieldCheck size={24} />
          <div>
            <strong>{session.user.name}</strong>
            <span>{session.tenant.name}</span>
            <small>
              {session.role} · {session.capabilities.length} capabilities
            </small>
          </div>
        </section>
        <section className="surface social-links">
          <div>
            <Link2 size={20} />
            <div>
              <h2>Linked sign-in providers</h2>
              <p>
                Social sign-in never creates or links an account implicitly.
              </p>
            </div>
          </div>
          {providers.map((provider) => {
            const isLinked = linked.some(
              (account) => account.providerId === provider,
            );
            return (
              <article key={provider}>
                <div>
                  <strong>
                    {provider[0].toUpperCase() + provider.slice(1)}
                  </strong>
                  <span>
                    {oauthEnabled
                      ? isLinked
                        ? `Linked · provider ID ${linked.find((account) => account.providerId === provider)?.accountId}${verifiedEmail ? ` · ${verifiedEmail}` : ""}`
                        : "Not linked"
                      : "Available after HTTPS and provider configuration"}
                  </span>
                </div>
                <button
                  className="secondary-button"
                  disabled={!oauthEnabled}
                  onClick={() =>
                    void (isLinked ? disconnect(provider) : connect(provider))
                  }
                >
                  {oauthEnabled
                    ? isLinked
                      ? "Disconnect"
                      : "Connect"
                    : "Not configured"}
                </button>
              </article>
            );
          })}
          {!oauthEnabled && (
            <p>Social sign-in is not configured for this deployment.</p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <PasswordChangeCard />
    </>
  );
}

"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PasswordChangeCard({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "The password could not be changed.");
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <section className="surface password-card">
      <div className="password-card-heading">
        <KeyRound size={21} />
        <div>
          <p className="eyebrow">ACCOUNT SECURITY</p>
          <h1>
            {forced ? "Change your one-time password" : "Change password"}
          </h1>
          <p>
            {forced
              ? "Only this security workflow is available until you choose a permanent password."
              : "Use at least 12 characters with letters and numbers."}
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="account-form">
        <label>
          <span>Current password</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          <span>New password</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Trash2, Webhook } from "lucide-react";
import { useState } from "react";

interface WebhookStatus {
  configured: boolean;
  updated_at: string | null;
  encryption_configured: boolean;
}

async function loadStatus(): Promise<WebhookStatus> {
  const response = await fetch("/api/account/discord-webhook", {
    cache: "no-store",
  });
  const payload = (await response.json()) as WebhookStatus & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Webhook status could not be loaded",
    );
  return payload;
}

async function request(method: "PUT" | "DELETE" | "POST", url?: string) {
  const endpoint =
    method === "POST"
      ? "/api/account/discord-webhook/test"
      : "/api/account/discord-webhook";
  const response = await fetch(endpoint, {
    method,
    headers: url ? { "content-type": "application/json" } : undefined,
    body: url ? JSON.stringify({ webhook_url: url }) : undefined,
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Webhook request failed");
}

export function DiscordWebhookCard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["personal-discord-webhook"],
    queryFn: loadStatus,
  });
  const mutation = useMutation({
    mutationFn: ({
      method,
      url,
    }: {
      method: "PUT" | "DELETE" | "POST";
      url?: string;
    }) => request(method, url),
    onSuccess: async (_data, variables) => {
      setUrl("");
      setNotice(
        variables.method === "POST"
          ? "Test message delivered."
          : variables.method === "DELETE"
            ? "Webhook removed."
            : "Webhook saved securely.",
      );
      await queryClient.invalidateQueries({
        queryKey: ["personal-discord-webhook"],
      });
    },
  });
  return (
    <section className="surface webhook-profile-card">
      <header>
        <Webhook size={20} />
        <div>
          <h2>Personal Discord webhook</h2>
          <p>Optional delivery target for your personal BGS rules.</p>
        </div>
      </header>
      {query.data?.configured ? (
        <p className="webhook-status">
          <strong>Configured</strong>
          <span>
            Secret is encrypted and never returned
            {query.data.updated_at
              ? ` · updated ${new Date(query.data.updated_at).toLocaleString("en-GB")}`
              : ""}
          </span>
        </p>
      ) : (
        <p className="webhook-status">
          <strong>Not configured</strong>
          <span>Dashboard alerts remain available without Discord.</span>
        </p>
      )}
      {!query.isPending && query.data && !query.data.encryption_configured && (
        <p className="form-error" role="alert">
          Server-side webhook encryption is not configured.
        </p>
      )}
      <label>
        <span>
          {query.data?.configured
            ? "Replace webhook URL"
            : "Discord webhook URL"}
        </span>
        <input
          type="password"
          autoComplete="off"
          value={url}
          placeholder="https://discord.com/api/webhooks/…"
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <div className="webhook-actions">
        <button
          className="primary-button"
          disabled={
            !url ||
            mutation.isPending ||
            query.data?.encryption_configured === false
          }
          onClick={() => mutation.mutate({ method: "PUT", url })}
        >
          Save webhook
        </button>
        <button
          className="secondary-button"
          disabled={!query.data?.configured || mutation.isPending}
          onClick={() => mutation.mutate({ method: "POST" })}
        >
          <Send size={13} /> Send test
        </button>
        <button
          className="secondary-button danger"
          disabled={!query.data?.configured || mutation.isPending}
          onClick={() => mutation.mutate({ method: "DELETE" })}
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
      {(query.isError || mutation.isError) && (
        <p className="form-error" role="alert">
          {query.error?.message ?? mutation.error?.message}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

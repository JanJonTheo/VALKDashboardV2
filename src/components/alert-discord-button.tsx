"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Send } from "lucide-react";
import type { BgsAlert } from "@/lib/bgs-rules";

export function AlertDiscordButton({ alert }: { alert: BgsAlert }) {
  const queryClient = useQueryClient();
  const requestId = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch(
        `/api/bgs-alerts/${encodeURIComponent(alert.id)}/discord`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request_id: requestId.current }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "Discord delivery could not be requested",
        );
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bgs-alerts"] });
      requestId.current = null;
    },
  });
  const delivery = alert.discord;
  const busy =
    mutation.isPending ||
    ["pending", "processing", "retry"].includes(delivery?.status ?? "");
  return (
    <div className="alert-discord-action">
      <button
        className="secondary-button"
        disabled={busy || !delivery?.configured}
        onClick={() => mutation.mutate()}
      >
        <Send size={13} />{" "}
        {busy
          ? "Discord delivery pending…"
          : delivery?.last_sent_at
            ? "Send to Discord again"
            : "Send to Discord"}
      </button>
      {!delivery?.configured && (
        <small>BGS channel webhook is not configured</small>
      )}
      {delivery?.last_sent_at && (
        <small>
          Last sent: {new Date(delivery.last_sent_at).toLocaleString("en-GB")}
        </small>
      )}
      {(mutation.isError || delivery?.error) && (
        <small role="alert">
          {mutation.isError ? mutation.error.message : delivery?.error}
        </small>
      )}
    </div>
  );
}

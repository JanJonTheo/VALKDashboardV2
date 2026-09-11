"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Trash2 } from "lucide-react";
import type { BgsAlert } from "@/lib/bgs-rules";

export function AlertLifecycleActions({ alert }: { alert: BgsAlert }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (action: "resolve" | "delete") => {
      const response = await fetch(
        `/api/bgs-alerts/${encodeURIComponent(alert.id)}${action === "resolve" ? "/resolve" : ""}`,
        {
          method: action === "resolve" ? "POST" : "DELETE",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error?.message ??
            "Alert action failed. Refresh and try again.",
        );
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["bgs-alerts"] });
      window.dispatchEvent(new CustomEvent("valk:alerts-updated"));
    },
  });
  if (!alert.can_manage) return null;
  return (
    <div className="alert-lifecycle-action">
      {!alert.resolved_at && (
        <button
          className="secondary-button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("resolve")}
        >
          <CheckCheck size={13} /> Mark resolved
        </button>
      )}
      <button
        className="secondary-button"
        disabled={mutation.isPending}
        onClick={() => {
          const shared =
            alert.owner_scope === "tenant"
              ? " This deletes the alert for everyone in this tenant."
              : "";
          if (
            window.confirm(
              `Permanently delete ${alert.title} in ${alert.system_name}?${shared} This cannot be undone.`,
            )
          )
            mutation.mutate("delete");
        }}
      >
        <Trash2 size={13} /> Delete
      </button>
      {mutation.isError && <small role="alert">{mutation.error.message}</small>}
    </div>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";

export function MarkAllAlertsRead({
  isAdmin,
  onMarked,
}: {
  isAdmin: boolean;
  onMarked?: (count: number | null) => void;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bgs-alerts/read-all", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload?.error?.message ?? "Alerts could not be marked as read",
        );
      return payload as { updated_count: number };
    },
    onMutate: () => onMarked?.(null),
    onSuccess: async (payload) => {
      await client.invalidateQueries({ queryKey: ["bgs-alerts"] });
      onMarked?.(payload.updated_count);
      window.dispatchEvent(new CustomEvent("valk:alerts-updated"));
    },
  });
  if (!isAdmin) return null;
  return (
    <div>
      <button
        className="secondary-button"
        disabled={mutation.isPending}
        onClick={() => {
          if (
            window.confirm(
              "Mark all alerts as read? This marks all personal and shared alerts available to you in this tenant as read for your account, including alerts outside the current filters. Other users' read states are unchanged.",
            )
          )
            mutation.mutate();
        }}
      >
        <CheckCheck size={15} />
        {mutation.isPending ? "Marking as read…" : "Mark all as read"}
      </button>
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    </div>
  );
}

"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

export function DashboardLoadingIndicator({
  pageRefreshing,
}: {
  pageRefreshing: boolean;
}) {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  if (!pageRefreshing && !fetching && !mutating) return null;

  const updating = mutating > 0;
  return (
    <div
      className="dashboard-loading-indicator"
      role="status"
      aria-live="polite"
      aria-label="Dashboard data is loading"
    >
      <span aria-hidden="true">
        <RefreshCw className="spin" size={22} />
      </span>
      <div>
        <strong>{updating ? "Updating dashboard" : "Loading data"}</strong>
        <small>
          {updating
            ? "Saving changes…"
            : pageRefreshing
              ? "Resetting the view and refreshing data…"
              : "Refreshing the current view…"}
        </small>
      </div>
    </div>
  );
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { normalizeWatchedSystems } from "@/lib/system-watchlist";
import type { AlertContext } from "@/lib/alert-context";

const Details = dynamic(() =>
  import("./system-watchlist").then((m) => m.SystemRecordDetail),
);
export const AlertSystemMap = dynamic(() =>
  import("./system-watchlist").then((m) => m.EdgisSystemMapDialog),
);

export function AlertSystemDetails({
  system,
  onClose,
  canRunBgsAi,
  context,
}: {
  system: string;
  onClose: () => void;
  canRunBgsAi: boolean;
  context?: AlertContext;
}) {
  const query = useQuery({
    queryKey: ["system-record-detail", system],
    queryFn: async () => {
      const response = await fetch(
        `/api/system-watchlist/detail?system=${encodeURIComponent(system)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.error?.message ?? "System details could not be loaded",
        );
      const found = normalizeWatchedSystems(payload).find(
        (item) => item.name.toLowerCase() === system.toLowerCase(),
      );
      if (!found?.available) throw new Error("No system data is available yet");
      return found;
    },
    staleTime: 60_000,
    retry: 1,
  });
  if (query.data?.available)
    return (
      <Details
        system={query.data}
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        canRunBgsAi={canRunBgsAi}
        alertContext={context}
      />
    );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content system-detail-sheet watch-history-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Record detail</Dialog.Title>
              <Dialog.Description>{system}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close details">
              <X size={19} />
            </Dialog.Close>
          </div>
          {query.isError || query.data?.available === false ? (
            <div role="alert">
              <p>{query.error?.message ?? "No system data is available yet"}</p>
              <button
                className="secondary-button"
                onClick={() => query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : (
            <p role="status">Loading system details…</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

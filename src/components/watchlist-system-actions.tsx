"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Pencil, X } from "lucide-react";
import { useState } from "react";
import {
  systemExternalLinks,
  watchlistLabelsSchema,
  type WatchlistLabels,
} from "@/lib/watchlist-labels";

export function SystemLinksMenu({
  system,
  onDetails,
  onMap,
}: {
  system: string;
  onDetails?: () => void;
  onMap?: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="watch-links-button"
        aria-label={`External links for ${system}`}
        title="External system links"
      >
        <ExternalLink size={13} />
        <ChevronDown size={10} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="watch-system-links-menu"
          align="end"
          sideOffset={8}
        >
          {systemExternalLinks(system).map((link) => (
            <DropdownMenu.Item key={link.label} asChild>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink size={12} />
              </a>
            </DropdownMenu.Item>
          ))}
          {onMap && (
            <DropdownMenu.Item onSelect={onMap}>EDGIS</DropdownMenu.Item>
          )}
          {onDetails && (
            <DropdownMenu.Item onSelect={onDetails}>
              Record Details
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SystemLabelsEditor({
  labels,
  shared,
  onSave,
}: {
  labels: WatchlistLabels;
  shared: boolean;
  onSave?: (labels: WatchlistLabels) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="watch-labels-button"
        aria-label={`Edit sector and project for ${labels.system}`}
        title="Edit sector and project"
        onClick={() => setOpen(true)}
      >
        <Pencil size={14} />
      </button>
      {open && (
        <LabelsDialog
          labels={labels}
          shared={shared}
          onSave={onSave}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function LabelsDialog({
  labels,
  shared,
  onSave,
  onClose,
}: {
  labels: WatchlistLabels;
  shared: boolean;
  onSave?: (labels: WatchlistLabels) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(labels);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = watchlistLabelsSchema.parse(draft);
      if (!shared) {
        if (!onSave) throw new Error("Personal labels cannot be saved");
        return onSave(parsed);
      }
      const response = await fetch("/api/system-watchlist/labels", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Labels could not be saved");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["system-watchlist-global"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["system-watchlist-protected"],
        }),
      ]);
      onClose();
    },
  });
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content watch-labels-dialog">
          <header className="sheet-heading">
            <div>
              <Dialog.Title>Sector and project</Dialog.Title>
              <Dialog.Description>
                {labels.system} ·{" "}
                {shared
                  ? "Shared across the global and protected watchlists."
                  : "Labels for your personal watchlist."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close labels"
              disabled={mutation.isPending}
            >
              <X size={18} />
            </Dialog.Close>
          </header>
          <form
            className="filter-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              <span>Sector</span>
              <input
                value={draft.sector}
                maxLength={80}
                onChange={(event) =>
                  setDraft({ ...draft, sector: event.target.value })
                }
              />
            </label>
            <label>
              <span>Project name</span>
              <input
                value={draft.projectName}
                maxLength={160}
                onChange={(event) =>
                  setDraft({ ...draft, projectName: event.target.value })
                }
              />
            </label>
            {mutation.isError && (
              <p className="form-error" role="alert">
                {mutation.error.message}
              </p>
            )}
            <footer>
              <Dialog.Close
                className="secondary-button"
                type="button"
                disabled={mutation.isPending}
              >
                Cancel
              </Dialog.Close>
              <button className="primary-button" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save labels"}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

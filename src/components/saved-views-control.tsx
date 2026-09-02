"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bookmark, Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ViewPreference } from "@/lib/preferences";
import type { useStoredViewPreference } from "@/lib/use-view-preference";

type ViewModel = Pick<
  ReturnType<typeof useStoredViewPreference>,
  | "collection"
  | "activeView"
  | "dirty"
  | "ready"
  | "saveError"
  | "applyView"
  | "saveAs"
  | "updateActive"
  | "renameView"
  | "deleteView"
>;

export function SavedViewsControl({
  model,
  onViewApplied,
}: {
  model: ViewModel;
  onViewApplied?: (view: ViewPreference) => void;
}) {
  const [dialog, setDialog] = useState<"save" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const openDialog = (mode: "save" | "rename") => {
    setDialog(mode);
    setName(mode === "rename" ? (model.activeView?.name ?? "") : "");
    setError("");
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      if (dialog === "rename" && model.activeView)
        model.renameView(model.activeView.id, name);
      else model.saveAs(name);
      setDialog(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "View not saved");
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="secondary-button saved-views-trigger"
          disabled={!model.ready}
        >
          <Bookmark size={15} />
          <span>{model.activeView?.name ?? "Views"}</span>
          {model.dirty && <i aria-label="Modified">Modified</i>}
          {model.saveError && (
            <i aria-label="Changes were not saved">Not saved</i>
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="saved-views-menu"
            sideOffset={7}
            align="end"
          >
            <DropdownMenu.Label>Saved views</DropdownMenu.Label>
            {model.collection.views.length === 0 && (
              <span className="saved-views-empty">No saved views yet</span>
            )}
            {model.collection.views.map((saved) => (
              <DropdownMenu.Item
                className="saved-view-item"
                key={saved.id}
                onSelect={() => {
                  model.applyView(saved.id);
                  onViewApplied?.(saved.view);
                }}
              >
                <span>{saved.name}</span>
                {saved.id === model.activeView?.id && <Check size={14} />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              className="saved-view-item"
              onSelect={() => openDialog("save")}
            >
              <Plus size={14} /> Save current view as…
            </DropdownMenu.Item>
            {model.activeView && (
              <>
                <DropdownMenu.Item
                  className="saved-view-item"
                  onSelect={model.updateActive}
                  disabled={!model.dirty}
                >
                  <Save size={14} /> Update saved view
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="saved-view-item"
                  onSelect={() => openDialog("rename")}
                >
                  <Pencil size={14} /> Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="saved-view-item danger"
                  onSelect={() => {
                    if (
                      window.confirm(
                        `Delete the view “${model.activeView?.name}”?`,
                      ) &&
                      model.activeView
                    )
                      model.deleteView(model.activeView.id);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </DropdownMenu.Item>
              </>
            )}
            {(model.saveError || error) && (
              <span className="saved-view-error" role="alert">
                {model.saveError || error}
              </span>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal-content saved-view-dialog">
            <div className="sheet-heading">
              <div>
                <Dialog.Title>
                  {dialog === "rename" ? "Rename view" : "Save current view"}
                </Dialog.Title>
                <Dialog.Description>
                  This view is private to you in the current tenant.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>
            <form onSubmit={submit}>
              <label>
                <span>View name</span>
                <input
                  autoFocus
                  value={name}
                  maxLength={64}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <Dialog.Close className="secondary-button">Cancel</Dialog.Close>
                <button className="primary-button" type="submit">
                  {dialog === "rename" ? "Rename" : "Save view"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

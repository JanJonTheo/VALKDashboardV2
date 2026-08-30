"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Power,
  PowerOff,
  Send,
  ShieldCheck,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";

export interface ManagedProtectedFaction {
  id: number;
  name: string;
  description: string;
  protected: boolean;
  webhook_configured: boolean;
}

interface FactionEnvelope {
  data: ManagedProtectedFaction[];
}

interface CandidateEnvelope {
  data: { name: string }[];
}

type EditorState =
  | { mode: "create"; faction: null }
  | { mode: "edit"; faction: ManagedProtectedFaction };

type ConfirmationState =
  | { kind: "deactivate"; faction: ManagedProtectedFaction }
  | { kind: "delete"; faction: ManagedProtectedFaction };

type MutationOperation = {
  kind:
    | "create"
    | "update"
    | "activate"
    | "deactivate"
    | "remove-webhook"
    | "test-webhook"
    | "delete";
  path: string;
  init: RequestInit;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.error?.message ?? "Protected faction operation failed",
    );
  return payload as T;
}

function operationNotice(kind: MutationOperation["kind"]): string {
  switch (kind) {
    case "create":
      return "Protected faction created.";
    case "update":
      return "Protected faction updated.";
    case "activate":
      return "Protected faction activated. The next evaluation creates a new baseline.";
    case "deactivate":
      return "Protected faction deactivated and open alerts resolved.";
    case "remove-webhook":
      return "Discord webhook removed.";
    case "test-webhook":
      return "Discord test message delivered.";
    case "delete":
      return "Protected faction permanently deleted.";
  }
}

export function ProtectedFactionAdministration() {
  const queryClient = useQueryClient();
  const factions = useQuery<FactionEnvelope>({
    queryKey: ["admin-protected-factions"],
    queryFn: () => api("/api/admin/protected-factions"),
  });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (operation: MutationOperation) =>
      api(operation.path, operation.init),
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: async (_payload, operation) => {
      setNotice(operationNotice(operation.kind));
      if (
        operation.kind === "create" ||
        operation.kind === "update" ||
        operation.kind === "remove-webhook"
      )
        setEditor(null);
      setConfirmation(null);
      await queryClient.invalidateQueries({
        queryKey: ["admin-protected-factions"],
      });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Protected faction operation failed",
      ),
  });

  const normalizedSearch = search.trim().toLocaleLowerCase("en");
  const visible = (factions.data?.data ?? []).filter((faction) => {
    if (status === "active" && !faction.protected) return false;
    if (status === "inactive" && faction.protected) return false;
    return (
      !normalizedSearch ||
      faction.name.toLocaleLowerCase("en").includes(normalizedSearch) ||
      faction.description.toLocaleLowerCase("en").includes(normalizedSearch)
    );
  });

  const mutate = (
    kind: MutationOperation["kind"],
    faction: ManagedProtectedFaction,
    init: RequestInit,
    suffix = "",
  ) =>
    mutation.mutate({
      kind,
      path: `/api/admin/protected-factions/${faction.id}${suffix}`,
      init,
    });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION / BGS PROTECTION</p>
          <h1>Protected factions</h1>
          <p>
            Manage tenant-wide protected factions, their monitoring status and
            Discord delivery targets.
          </p>
        </div>
        <div>
          <button
            className="primary-button"
            onClick={() => setEditor({ mode: "create", faction: null })}
          >
            <Plus size={15} />
            New protected faction
          </button>
        </div>
      </header>

      {(error || factions.isError) && (
        <div className="error-banner" role="alert">
          <strong>
            {error ||
              (factions.error instanceof Error
                ? factions.error.message
                : "Protected factions could not be loaded")}
          </strong>
          {error && <button onClick={() => setError("")}>Dismiss</button>}
        </div>
      )}
      {notice && (
        <p className="form-success protected-faction-notice" role="status">
          {notice}
        </p>
      )}

      <section className="surface protected-faction-admin-surface">
        <div className="protected-faction-toolbar">
          <label>
            <span>Search factions</span>
            <input
              type="search"
              placeholder="Name or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Protection status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="all">All factions</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </label>
        </div>

        {factions.isLoading && (
          <p className="inline-empty">Loading protected factions…</p>
        )}
        {!factions.isLoading && !factions.isError && visible.length === 0 && (
          <p className="inline-empty">
            {factions.data?.data.length
              ? "No protected factions match these filters."
              : "No protected factions have been configured for this tenant."}
          </p>
        )}
        <div className="protected-faction-list">
          {visible.map((faction) => (
            <article className="protected-faction-admin-row" key={faction.id}>
              <div className="protected-faction-identity">
                <ShieldCheck size={19} />
                <div>
                  <strong>{faction.name}</strong>
                  <span>{faction.description || "No description"}</span>
                </div>
              </div>
              <div className="protected-faction-state">
                <span
                  className={
                    faction.protected
                      ? "protected-status active"
                      : "protected-status inactive"
                  }
                >
                  {faction.protected ? "Active" : "Inactive"}
                </span>
                <span className="protected-webhook-state">
                  <Webhook size={14} />
                  {faction.webhook_configured
                    ? "Discord configured"
                    : "Dashboard alerts only"}
                </span>
              </div>
              <div className="protected-faction-actions">
                <button
                  className="secondary-button"
                  disabled={!faction.webhook_configured || mutation.isPending}
                  onClick={() =>
                    mutate(
                      "test-webhook",
                      faction,
                      { method: "POST" },
                      "/webhook-test",
                    )
                  }
                >
                  <Send size={14} /> Test webhook
                </button>
                <button
                  className="secondary-button"
                  disabled={mutation.isPending}
                  onClick={() => setEditor({ mode: "edit", faction })}
                >
                  <Pencil size={14} /> Edit
                </button>
                {faction.protected ? (
                  <button
                    className="secondary-button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      setConfirmation({ kind: "deactivate", faction })
                    }
                  >
                    <PowerOff size={14} /> Deactivate
                  </button>
                ) : (
                  <button
                    className="secondary-button"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutate("activate", faction, {
                        method: "PATCH",
                        body: JSON.stringify({ protected: true }),
                      })
                    }
                  >
                    <Power size={14} /> Activate
                  </button>
                )}
                <button
                  className="danger-button"
                  disabled={mutation.isPending}
                  onClick={() => setConfirmation({ kind: "delete", faction })}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Dialog.Root
        open={editor !== null}
        onOpenChange={(open) => !open && setEditor(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal-content protected-faction-editor">
            <div className="sheet-heading">
              <div>
                <Dialog.Title>
                  {editor?.mode === "edit"
                    ? "Edit protected faction"
                    : "Create protected faction"}
                </Dialog.Title>
                <Dialog.Description>
                  The faction name should match EDDN. Suggestions are optional,
                  so factions without current EDDN presence can still be saved.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close">
                <X size={19} />
              </Dialog.Close>
            </div>
            {editor && (
              <ProtectedFactionForm
                key={`${editor.mode}-${editor.faction?.id ?? "new"}`}
                editor={editor}
                pending={mutation.isPending}
                onCancel={() => setEditor(null)}
                onRemoveWebhook={
                  editor.faction?.webhook_configured
                    ? () =>
                        mutate("remove-webhook", editor.faction!, {
                          method: "PATCH",
                          body: JSON.stringify({ webhook_url: null }),
                        })
                    : undefined
                }
                onSubmit={(value) => {
                  if (editor.mode === "create")
                    mutation.mutate({
                      kind: "create",
                      path: "/api/admin/protected-factions",
                      init: { method: "POST", body: JSON.stringify(value) },
                    });
                  else
                    mutate("update", editor.faction, {
                      method: "PATCH",
                      body: JSON.stringify(value),
                    });
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmationDialog
        state={confirmation}
        pending={mutation.isPending}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.kind === "delete")
            mutate("delete", confirmation.faction, { method: "DELETE" });
          else
            mutate("deactivate", confirmation.faction, {
              method: "PATCH",
              body: JSON.stringify({ protected: false }),
            });
        }}
      />
    </>
  );
}

function ProtectedFactionForm({
  editor,
  pending,
  onSubmit,
  onCancel,
  onRemoveWebhook,
}: {
  editor: EditorState;
  pending: boolean;
  onSubmit: (value: {
    name: string;
    description: string;
    protected?: boolean;
    webhook_url?: string;
  }) => void;
  onCancel: () => void;
  onRemoveWebhook?: () => void;
}) {
  const faction = editor.faction;
  const [name, setName] = useState(faction?.name ?? "");
  const [description, setDescription] = useState(faction?.description ?? "");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [protectedState, setProtectedState] = useState(true);
  const deferredName = useDeferredValue(name.trim());
  const candidates = useQuery<CandidateEnvelope>({
    queryKey: ["protected-faction-candidates", deferredName],
    queryFn: () =>
      api(
        `/api/admin/protected-factions/candidates?q=${encodeURIComponent(deferredName)}`,
      ),
    enabled: deferredName.length >= 2,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value: {
      name: string;
      description: string;
      protected?: boolean;
      webhook_url?: string;
    } = { name: name.trim(), description: description.trim() };
    if (editor.mode === "create") value.protected = protectedState;
    if (webhookUrl.trim()) value.webhook_url = webhookUrl.trim();
    onSubmit(value);
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <label>
        <span>Faction name</span>
        <input
          name="name"
          aria-label="Faction name"
          list="protected-faction-candidates"
          value={name}
          maxLength={128}
          autoComplete="off"
          required
          onChange={(event) => setName(event.target.value)}
        />
        <datalist id="protected-faction-candidates">
          {candidates.data?.data.map((candidate) => (
            <option key={candidate.name} value={candidate.name} />
          ))}
        </datalist>
        <small>
          {candidates.isFetching
            ? "Searching EDDN…"
            : "Select an EDDN suggestion or keep the exact free-text name."}
        </small>
      </label>
      <label>
        <span>Description</span>
        <input
          name="description"
          aria-label="Description"
          value={description}
          maxLength={128}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        <span>
          {faction?.webhook_configured
            ? "Replace Discord webhook URL"
            : "Discord webhook URL (optional)"}
        </span>
        <input
          name="webhook_url"
          aria-label={
            faction?.webhook_configured
              ? "Replace Discord webhook URL"
              : "Discord webhook URL (optional)"
          }
          type="password"
          autoComplete="off"
          value={webhookUrl}
          placeholder="https://discord.com/api/webhooks/…"
          onChange={(event) => setWebhookUrl(event.target.value)}
        />
        <small>
          {faction?.webhook_configured
            ? "Leave blank to keep the stored webhook. The secret is never displayed."
            : "Dashboard alerts remain available without Discord."}
        </small>
      </label>
      {editor.mode === "create" && (
        <label className="active-toggle">
          <input
            type="checkbox"
            checked={protectedState}
            onChange={(event) => setProtectedState(event.target.checked)}
          />
          <span>Active immediately</span>
        </label>
      )}
      {candidates.isError && (
        <p className="form-error" role="alert">
          EDDN suggestions are unavailable. You can still enter the faction name
          manually.
        </p>
      )}
      <footer className="protected-faction-form-footer">
        {onRemoveWebhook && (
          <button
            className="danger-button protected-faction-remove-webhook"
            type="button"
            disabled={pending}
            onClick={() =>
              window.confirm("Remove the stored Discord webhook?") &&
              onRemoveWebhook()
            }
          >
            <Trash2 size={14} /> Remove webhook
          </button>
        )}
        <span />
        <button
          className="secondary-button"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="primary-button" disabled={pending || !name.trim()}>
          {editor.mode === "create" ? "Create faction" : "Save changes"}
        </button>
      </footer>
    </form>
  );
}

function ConfirmationDialog({
  state,
  pending,
  onClose,
  onConfirm,
}: {
  state: ConfirmationState | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typedName, setTypedName] = useState("");
  const destructive = state?.kind === "delete";
  const allowed = !destructive || typedName === state?.faction.name;
  return (
    <Dialog.Root
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTypedName("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>
                {destructive
                  ? "Delete protected faction"
                  : "Deactivate protected faction"}
              </Dialog.Title>
              <Dialog.Description>
                {destructive
                  ? "This entry is removed permanently. Existing Early Warning packages stay paused for audit and are not transferred to a replacement faction."
                  : "The faction disappears from the watchlist selector and Rule Catalog. Open alerts are resolved; reactivation starts with a new baseline."}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close">
              <X size={19} />
            </Dialog.Close>
          </div>
          {destructive && state && (
            <label className="protected-faction-delete-confirmation">
              <span>Type {state.faction.name} to confirm</span>
              <input
                autoComplete="off"
                aria-label={`Type ${state.faction.name} to confirm`}
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
              />
            </label>
          )}
          <footer className="protected-faction-confirm-footer">
            <Dialog.Close className="secondary-button" disabled={pending}>
              Cancel
            </Dialog.Close>
            <button
              className={destructive ? "danger-button" : "primary-button"}
              disabled={pending || !allowed}
              onClick={() => {
                onConfirm();
                setTypedName("");
              }}
            >
              {destructive ? "Delete permanently" : "Deactivate faction"}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  bgsRuleConditionOptions,
  bgsRuleTemplateInputSchema,
  type BgsCondition,
  type BgsRuleCatalogPayload,
  type BgsRuleConditionType,
  type BgsRulePackage,
  type BgsRuleTemplate,
  type BgsRuleTemplateInput,
} from "@/lib/bgs-rules";

async function loadCatalog(includeArchived: boolean) {
  const response = await fetch(
    `/api/bgs-rule-templates${includeArchived ? "?include_archived=true" : ""}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as BgsRuleCatalogPayload & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Rule catalog could not be loaded",
    );
  return payload;
}

async function applyTemplate(input: {
  templateId: string;
  watchlistScope: "personal" | "global" | "protected";
  protectedFactionId?: number;
  discord: boolean;
}) {
  const response = await fetch(
    `/api/bgs-rule-templates/${input.templateId}/apply`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        watchlist_scope: input.watchlistScope,
        ...(input.protectedFactionId
          ? { protected_faction_id: input.protectedFactionId }
          : {}),
        discord: input.discord,
      }),
    },
  );
  const payload = (await response.json()) as {
    data?: BgsRulePackage;
    already_applied?: boolean;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Rule template could not be applied",
    );
  return payload;
}

async function saveTemplate(input: {
  id?: string;
  template: BgsRuleTemplateInput;
}) {
  const response = await fetch(
    input.id
      ? `/api/bgs-rule-templates/${input.id}`
      : "/api/bgs-rule-templates",
    {
      method: input.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.template),
    },
  );
  const payload = (await response.json()) as {
    data?: BgsRuleTemplate;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Rule template could not be saved",
    );
  return payload.data;
}

async function setTemplateArchived(input: { id: string; archived: boolean }) {
  const response = await fetch(`/api/bgs-rule-templates/${input.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ archived: input.archived }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Rule template could not be updated",
    );
}

async function syncPackage(packageId: string) {
  const response = await fetch(`/api/bgs-rule-packages/${packageId}/sync`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    data?: BgsRulePackage;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? "Rule package could not be updated",
    );
  return payload.data;
}

function conditionFor(type: BgsRuleConditionType): BgsCondition {
  if (type === "tenant_faction_new_conflict")
    return { type, conflict_types: ["election", "war"] };
  if (type === "tenant_faction_loss")
    return {
      type,
      threshold_pp: 3,
      comparison: "previous_settled_tick",
    };
  if (type === "tenant_faction_below") return { type, threshold_pp: 5 };
  if (type === "tenant_faction_gap")
    return { type, threshold_pp: 2, gap_mode: "absolute" };
  return {
    type,
    threshold_pp: 5,
    ...(type.endsWith("_gain") ||
    type.endsWith("_loss") ||
    type === "controller_loss"
      ? { window_days: 1 }
      : {}),
  };
}

function emptyTemplate(): BgsRuleTemplateInput {
  return {
    name: "",
    description: "",
    default_discord: true,
    items: [
      {
        key: "rule-1",
        name: "",
        condition: conditionFor("tenant_faction_below"),
        severity: "warning",
      },
    ],
  };
}

function packageFor(
  template: BgsRuleTemplate,
  scope: "personal" | "global" | "protected",
  protectedFactionId?: number,
) {
  return template.packages.find(
    (item) =>
      item.watchlist_scope === scope &&
      (scope !== "protected" ||
        item.protected_faction_id === protectedFactionId),
  );
}

const protectedFactionConditionLabels: Partial<
  Record<BgsRuleConditionType, string>
> = {
  tenant_faction_loss: "Protected faction loses influence",
  tenant_faction_new_conflict: "Protected faction enters a conflict",
  tenant_faction_below: "Protected faction below threshold",
  tenant_faction_gap: "Another faction closes the gap to the protected faction",
};

function conditionLabel(
  type: BgsRuleConditionType,
  targetKind: BgsRuleTemplate["target_kind"],
) {
  const option = bgsRuleConditionOptions.find(
    (candidate) => candidate.value === type,
  );
  return targetKind === "protected_faction"
    ? (protectedFactionConditionLabels[type] ?? option?.label ?? type)
    : (option?.label ?? type);
}

function conditionSummary(
  condition: BgsCondition,
  targetKind: BgsRuleTemplate["target_kind"],
) {
  const label = conditionLabel(condition.type, targetKind);
  if (condition.type === "tenant_faction_new_conflict")
    return `${label}: Election, War`;
  const suffix =
    condition.threshold_pp === undefined
      ? ""
      : ` · ${condition.threshold_pp} pp`;
  return `${label}${suffix}`;
}

export function BgsRuleCatalog({
  canManageTenant,
}: {
  canManageTenant: boolean;
}) {
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [scope, setScope] = useState<"personal" | "global" | "protected">(
    "personal",
  );
  const [protectedFactionId, setProtectedFactionId] = useState<number>();
  const [selectedTemplate, setSelectedTemplate] = useState<BgsRuleTemplate>();
  const [expandedPackage, setExpandedPackage] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<BgsRuleTemplateInput>(emptyTemplate);
  const [formError, setFormError] = useState("");
  const catalogQuery = useQuery({
    queryKey: ["bgs-rule-catalog", includeArchived],
    queryFn: () => loadCatalog(includeArchived),
  });
  const availability = catalogQuery.data?.discord_availability;
  const [discord, setDiscord] = useState(true);
  const selectedProtectedFaction = (
    catalogQuery.data?.protected_factions ?? []
  ).find((faction) => faction.id === protectedFactionId);
  const currentAvailability =
    scope === "protected"
      ? Boolean(selectedProtectedFaction?.webhook_configured)
      : Boolean(availability?.[scope]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bgs-rule-catalog"] }),
      queryClient.invalidateQueries({ queryKey: ["bgs-rules"] }),
    ]);
  };
  const applyMutation = useMutation({
    mutationFn: applyTemplate,
    onSuccess: async (payload) => {
      setSelectedTemplate(undefined);
      if (payload.data) setExpandedPackage(payload.data.id);
      await invalidate();
    },
  });
  const saveMutation = useMutation({
    mutationFn: saveTemplate,
    onSuccess: async () => {
      setEditorOpen(false);
      setEditingId(undefined);
      setDraft(emptyTemplate());
      await invalidate();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: setTemplateArchived,
    onSuccess: invalidate,
  });
  const syncMutation = useMutation({
    mutationFn: syncPackage,
    onSuccess: invalidate,
  });

  const error =
    catalogQuery.error ??
    applyMutation.error ??
    saveMutation.error ??
    archiveMutation.error ??
    syncMutation.error;
  const templates = useMemo(
    () => catalogQuery.data?.data ?? [],
    [catalogQuery.data?.data],
  );
  const editingTargetKind =
    templates.find((template) => template.id === editingId)?.target_kind ??
    "watchlist";

  function beginCreate() {
    setEditingId(undefined);
    setDraft(emptyTemplate());
    setFormError("");
    setEditorOpen(true);
  }

  function beginEdit(template: BgsRuleTemplate) {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      description: template.description,
      default_discord: template.default_discord,
      items: template.items.map((item) => ({
        ...item,
        condition: { ...item.condition },
      })),
    });
    setFormError("");
    setEditorOpen(true);
  }

  function submitTemplate(event: React.FormEvent) {
    event.preventDefault();
    const parsed = bgsRuleTemplateInputSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Review the template");
      return;
    }
    saveMutation.mutate({ id: editingId, template: parsed.data });
  }

  function openApply(template: BgsRuleTemplate) {
    if ((template.target_kind ?? "watchlist") === "protected_faction") {
      const firstFaction = catalogQuery.data?.protected_factions?.[0];
      setScope("protected");
      setProtectedFactionId(firstFaction?.id);
      setDiscord(
        template.default_discord && Boolean(firstFaction?.webhook_configured),
      );
      setSelectedTemplate(template);
      return;
    }
    const nextScope: "personal" | "global" =
      scope !== "global" || !catalogQuery.data?.can_apply_global
        ? "personal"
        : "global";
    setScope(nextScope);
    setProtectedFactionId(undefined);
    setDiscord(
      template.default_discord &&
        Boolean(catalogQuery.data?.discord_availability[nextScope]),
    );
    setSelectedTemplate(template);
  }

  return (
    <section className="bgs-catalog" aria-busy={catalogQuery.isPending}>
      <header className="bgs-catalog-toolbar">
        <div>
          <BookOpen size={18} />
          <span>
            <strong>Rule catalog</strong>
            <small>Apply versioned rule packages to a watchlist.</small>
          </span>
        </div>
        {canManageTenant && (
          <div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              Archived
            </label>
            <button className="secondary-button" onClick={beginCreate}>
              <Plus size={14} /> New template
            </button>
          </div>
        )}
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error.message}
        </p>
      )}
      {catalogQuery.isPending && (
        <p className="inline-empty">Loading catalog…</p>
      )}
      {!catalogQuery.isPending && !templates.length && (
        <p className="inline-empty">No rule templates are available.</p>
      )}
      <div className="bgs-catalog-grid">
        {templates.map((template) => {
          const personalPackage = packageFor(template, "personal");
          const globalPackage = packageFor(template, "global");
          const protectedTemplate =
            (template.target_kind ?? "watchlist") === "protected_faction";
          const packages = protectedTemplate
            ? template.packages.filter(
                (item) => item.watchlist_scope === "protected",
              )
            : [personalPackage, globalPackage].filter(
                (item): item is BgsRulePackage => Boolean(item),
              );
          return (
            <article
              key={template.id}
              className={template.archived ? "archived" : ""}
            >
              <header>
                <div>
                  <strong>{template.name}</strong>
                  <span>Version {template.version}</span>
                </div>
                {template.archived && (
                  <span className="severity-pill info">Archived</span>
                )}
              </header>
              <p>{template.description}</p>
              <ul>
                {template.items.map((item) => (
                  <li key={item.key}>
                    <span className={`severity-pill ${item.severity}`}>
                      {item.severity}
                    </span>
                    {conditionSummary(
                      item.condition,
                      template.target_kind ?? "watchlist",
                    )}
                  </li>
                ))}
              </ul>
              {packages.map((item) => {
                const updateAvailable =
                  item.template_version < template.version;
                return (
                  <div className="bgs-package-row" key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPackage((current) =>
                          current === item.id ? undefined : item.id,
                        )
                      }
                    >
                      <CheckCircle2 size={14} />{" "}
                      {item.watchlist_scope === "protected"
                        ? `${item.protected_faction?.name ?? "Unavailable faction"} applied`
                        : `${item.watchlist_scope} applied`}
                    </button>
                    {updateAvailable && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Update this package? Individual rule changes will be replaced and a new baseline will be formed.",
                            )
                          )
                            syncMutation.mutate(item.id);
                        }}
                      >
                        <RefreshCw size={13} /> Update available
                      </button>
                    )}
                    {expandedPackage === item.id && (
                      <ul className="bgs-package-rules">
                        {item.rules.map((rule) => (
                          <li key={rule.id}>
                            {rule.name} · {rule.enabled ? "enabled" : "retired"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              <footer>
                {!template.archived &&
                  (!protectedTemplate ||
                    catalogQuery.data?.can_apply_protected) && (
                    <button
                      className="primary-button"
                      onClick={() => openApply(template)}
                    >
                      {protectedTemplate
                        ? packages.length
                          ? "Open / apply"
                          : "Apply template"
                        : personalPackage && (!canManageTenant || globalPackage)
                          ? "Open / apply"
                          : "Apply template"}
                    </button>
                  )}
                {canManageTenant && (
                  <>
                    <button
                      className="secondary-button"
                      onClick={() => beginEdit(template)}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        archiveMutation.mutate({
                          id: template.id,
                          archived: !template.archived,
                        })
                      }
                    >
                      {template.archived ? (
                        <RotateCcw size={13} />
                      ) : (
                        <Archive size={13} />
                      )}
                      {template.archived ? "Restore" : "Archive"}
                    </button>
                  </>
                )}
              </footer>
            </article>
          );
        })}
      </div>

      <Dialog.Root
        open={Boolean(selectedTemplate)}
        onOpenChange={(open) => !open && setSelectedTemplate(undefined)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal-content bgs-apply-dialog">
            <header className="sheet-heading">
              <div>
                <Dialog.Title>{selectedTemplate?.name}</Dialog.Title>
                <Dialog.Description>
                  Apply all {selectedTemplate?.items.length ?? 0} rules
                  atomically.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close apply dialog">
                <X size={18} />
              </Dialog.Close>
            </header>
            {(selectedTemplate?.target_kind ?? "watchlist") ===
            "protected_faction" ? (
              <label>
                <span>Protected faction</span>
                <select
                  aria-label="Protected faction"
                  value={protectedFactionId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    const faction = (
                      catalogQuery.data?.protected_factions ?? []
                    ).find((item) => item.id === nextId);
                    setProtectedFactionId(nextId);
                    setDiscord(
                      Boolean(selectedTemplate?.default_discord) &&
                        Boolean(faction?.webhook_configured),
                    );
                  }}
                >
                  {!catalogQuery.data?.protected_factions?.length && (
                    <option value="">No active protected factions</option>
                  )}
                  {(catalogQuery.data?.protected_factions ?? []).map(
                    (faction) => (
                      <option value={faction.id} key={faction.id}>
                        {faction.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : (
              <label>
                <span>Watchlist</span>
                <select
                  value={scope}
                  onChange={(event) => {
                    const next = event.target.value as "personal" | "global";
                    setScope(next);
                    setDiscord(
                      Boolean(selectedTemplate?.default_discord) &&
                        Boolean(availability?.[next]),
                    );
                  }}
                >
                  <option value="personal">Personal watchlist</option>
                  {catalogQuery.data?.can_apply_global && (
                    <option value="global">
                      Global tenant-faction watchlist
                    </option>
                  )}
                </select>
              </label>
            )}
            <label className="check-row">
              <input
                type="checkbox"
                checked={discord && currentAvailability}
                disabled={!currentAvailability}
                onChange={(event) => setDiscord(event.target.checked)}
              />
              Send to the{" "}
              {scope === "personal"
                ? "personal"
                : scope === "protected"
                  ? "protected faction"
                  : "tenant BGS"}{" "}
              Discord webhook
            </label>
            {!currentAvailability && (
              <small className="inline-empty">
                No valid webhook is configured for this scope; dashboard alerts
                remain enabled.
              </small>
            )}
            {selectedTemplate &&
              packageFor(selectedTemplate, scope, protectedFactionId) && (
                <p className="inline-empty">
                  This template is already applied. Continue to open the
                  existing package.
                </p>
              )}
            <footer>
              <Dialog.Close className="secondary-button">Cancel</Dialog.Close>
              <button
                className="primary-button"
                disabled={
                  applyMutation.isPending ||
                  !selectedTemplate ||
                  (scope === "protected" && !protectedFactionId)
                }
                onClick={() =>
                  selectedTemplate &&
                  applyMutation.mutate({
                    templateId: selectedTemplate.id,
                    watchlistScope: scope,
                    protectedFactionId,
                    discord,
                  })
                }
              >
                {selectedTemplate &&
                packageFor(selectedTemplate, scope, protectedFactionId)
                  ? "Open package"
                  : "Apply package"}
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={editorOpen} onOpenChange={setEditorOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="sheet-content bgs-template-editor">
            <header className="sheet-heading">
              <div>
                <Dialog.Title>
                  {editingId ? "Edit template" : "New template"}
                </Dialog.Title>
                <Dialog.Description>
                  Template updates are explicit for already applied packages.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close template editor">
                <X size={18} />
              </Dialog.Close>
            </header>
            <form onSubmit={submitTemplate}>
              <label>
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={draft.default_discord}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      default_discord: event.target.checked,
                    })
                  }
                />
                Preselect Discord delivery when available
              </label>
              <div className="bgs-template-items">
                <header>
                  <strong>Rules</strong>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={draft.items.length >= 20}
                    onClick={() => {
                      const number = draft.items.length + 1;
                      setDraft({
                        ...draft,
                        items: [
                          ...draft.items,
                          {
                            key: `rule-${Date.now()}-${number}`,
                            name: "New rule",
                            condition: conditionFor("tenant_faction_below"),
                            severity: "warning",
                          },
                        ],
                      });
                    }}
                  >
                    <Plus size={13} /> Add rule
                  </button>
                </header>
                {draft.items.map((item, index) => (
                  <article key={item.key}>
                    <label>
                      <span>Rule name</span>
                      <input
                        value={item.name}
                        onChange={(event) => {
                          const items = [...draft.items];
                          items[index] = { ...item, name: event.target.value };
                          setDraft({ ...draft, items });
                        }}
                      />
                    </label>
                    <label>
                      <span>Condition</span>
                      <select
                        value={item.condition.type}
                        onChange={(event) => {
                          const items = [...draft.items];
                          items[index] = {
                            ...item,
                            condition: conditionFor(
                              event.target.value as BgsRuleConditionType,
                            ),
                          };
                          setDraft({ ...draft, items });
                        }}
                      >
                        {bgsRuleConditionOptions.map((option) => (
                          <option value={option.value} key={option.value}>
                            {conditionLabel(option.value, editingTargetKind)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {item.condition.type !== "tenant_faction_new_conflict" && (
                      <label>
                        <span>Threshold (pp)</span>
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={item.condition.threshold_pp ?? ""}
                          onChange={(event) => {
                            const items = [...draft.items];
                            items[index] = {
                              ...item,
                              condition: {
                                ...item.condition,
                                threshold_pp: Number(event.target.value),
                              },
                            };
                            setDraft({ ...draft, items });
                          }}
                        />
                      </label>
                    )}
                    <label>
                      <span>Severity</span>
                      <select
                        value={item.severity}
                        onChange={(event) => {
                          const items = [...draft.items];
                          items[index] = {
                            ...item,
                            severity: event.target
                              .value as typeof item.severity,
                          };
                          setDraft({ ...draft, items });
                        }}
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      disabled={draft.items.length <= 1}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
              {(formError || saveMutation.isError) && (
                <p className="form-error" role="alert">
                  {formError || saveMutation.error?.message}
                </p>
              )}
              <footer>
                <Dialog.Close className="secondary-button">Cancel</Dialog.Close>
                <button
                  className="primary-button"
                  disabled={saveMutation.isPending}
                >
                  {editingId ? "Save template" : "Create template"}
                </button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

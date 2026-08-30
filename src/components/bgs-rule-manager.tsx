"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BgsRuleCatalog } from "@/components/bgs-rule-catalog";
import {
  bgsRuleConditionOptions,
  bgsRuleInputSchema,
  defaultBgsRuleInput,
  type BgsRule,
  type BgsRuleInput,
  type BgsRuleOwnerScope,
} from "@/lib/bgs-rules";

async function loadRules(): Promise<BgsRule[]> {
  const response = await fetch("/api/bgs-rules", { cache: "no-store" });
  const payload = (await response.json()) as {
    data?: BgsRule[];
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Rules could not be loaded");
  return payload.data ?? [];
}

async function saveRule(input: { id?: string; rule: BgsRuleInput }) {
  const response = await fetch(
    input.id ? `/api/bgs-rules/${input.id}` : "/api/bgs-rules",
    {
      method: input.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.rule),
    },
  );
  const payload = (await response.json()) as {
    data?: BgsRule;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Rule could not be saved");
  return payload.data;
}

async function deleteRule(id: string) {
  const response = await fetch(`/api/bgs-rules/${id}`, { method: "DELETE" });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Rule could not be deleted");
}

export function BgsRuleManager({
  open,
  onOpenChange,
  initialSystem,
  systems,
  canManageTenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSystem?: string;
  systems: string[];
  canManageTenant: boolean;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"rules" | "catalog">("rules");
  const [scope, setScope] = useState<BgsRuleOwnerScope>("personal");
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<BgsRuleInput>(() => ({
    ...defaultBgsRuleInput,
    target_scope: initialSystem ? "system" : "watchlist_all",
    target_system: initialSystem ?? null,
    name: initialSystem
      ? `${initialSystem} influence guard`
      : "Global influence guard",
  }));
  const [formError, setFormError] = useState("");
  const rulesQuery = useQuery({
    queryKey: ["bgs-rules"],
    queryFn: loadRules,
    enabled: open,
  });
  const saveMutation = useMutation({
    mutationFn: saveRule,
    onSuccess: async () => {
      setEditingId(undefined);
      setDraft({
        ...defaultBgsRuleInput,
        owner_scope: scope,
        target_scope: "watchlist_all",
      });
      await queryClient.invalidateQueries({ queryKey: ["bgs-rules"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["bgs-rules"] }),
  });

  const visible = useMemo(
    () => (rulesQuery.data ?? []).filter((rule) => rule.owner_scope === scope),
    [rulesQuery.data, scope],
  );
  const condition = bgsRuleConditionOptions.find(
    (option) => option.value === draft.condition_type,
  );

  function beginNew(ownerScope: BgsRuleOwnerScope) {
    setScope(ownerScope);
    setEditingId(undefined);
    setFormError("");
    setDraft({
      ...defaultBgsRuleInput,
      owner_scope: ownerScope,
      target_scope: initialSystem ? "system" : "watchlist_all",
      target_system: initialSystem ?? null,
      name: initialSystem
        ? `${initialSystem} influence guard`
        : "Global influence guard",
    });
  }

  function edit(rule: BgsRule) {
    setEditingId(rule.id);
    setScope(rule.owner_scope);
    setFormError("");
    setDraft({
      name: rule.name,
      owner_scope: rule.owner_scope,
      target_scope: rule.target_scope,
      target_system: rule.target_system,
      condition_type: rule.condition_type,
      threshold_pp: rule.threshold_pp,
      window_days: rule.window_days,
      severity: rule.severity,
      personal_discord: rule.personal_discord,
      tenant_discord: rule.tenant_discord,
      enabled: rule.enabled,
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const parsed = bgsRuleInputSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Review the rule fields");
      return;
    }
    saveMutation.mutate({ id: editingId, rule: parsed.data });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="sheet-content bgs-rule-sheet">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>BGS alert rules</Dialog.Title>
              <Dialog.Description>
                Evaluate settled snapshots and persist edge-triggered alerts.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close rules">
              <X size={19} />
            </Dialog.Close>
          </div>
          <div
            className="bgs-scope-tabs bgs-manager-tabs"
            role="tablist"
            aria-label="Rule manager view"
          >
            <button
              className={view === "rules" ? "active" : ""}
              onClick={() => setView("rules")}
            >
              Rules
            </button>
            <button
              className={view === "catalog" ? "active" : ""}
              onClick={() => setView("catalog")}
            >
              Catalog
            </button>
          </div>
          {view === "rules" ? (
            <>
              <div
                className="bgs-scope-tabs"
                role="tablist"
                aria-label="Rule ownership"
              >
                <button
                  className={scope === "personal" ? "active" : ""}
                  onClick={() => beginNew("personal")}
                >
                  Personal
                </button>
                {canManageTenant && (
                  <button
                    className={scope === "tenant" ? "active" : ""}
                    onClick={() => beginNew("tenant")}
                  >
                    Tenant-wide
                  </button>
                )}
              </div>
              <div className="bgs-rule-layout">
                <section
                  className="bgs-rule-list"
                  aria-busy={rulesQuery.isPending}
                >
                  <header>
                    <strong>
                      {scope === "personal" ? "Your rules" : "Tenant rules"}
                    </strong>
                    <button
                      className="secondary-button"
                      onClick={() => beginNew(scope)}
                    >
                      <Plus size={14} /> New
                    </button>
                  </header>
                  {rulesQuery.isError && (
                    <p className="form-error" role="alert">
                      {rulesQuery.error.message}
                    </p>
                  )}
                  {!rulesQuery.isPending && !visible.length && (
                    <p className="inline-empty">No rules in this scope.</p>
                  )}
                  {visible.map((rule, index) => (
                    <div className="bgs-rule-list-item" key={rule.id}>
                      {rule.package_id &&
                        visible.findIndex(
                          (candidate) =>
                            candidate.package_id === rule.package_id,
                        ) === index && (
                          <div className="bgs-rule-package-heading">
                            <strong>Catalog package</strong>
                            <span>
                              Template version {rule.template_version}
                            </span>
                          </div>
                        )}
                      <article
                        className={editingId === rule.id ? "active" : ""}
                      >
                        <div>
                          <strong>{rule.name}</strong>
                          <span>
                            {rule.target_scope === "watchlist_all"
                              ? "All watched systems"
                              : rule.target_system}{" "}
                            · {rule.threshold_pp} pp
                          </span>
                        </div>
                        <span className={`severity-pill ${rule.severity}`}>
                          {rule.severity}
                        </span>
                        <button
                          aria-label={`Edit ${rule.name}`}
                          title="Edit rule"
                          onClick={() => edit(rule)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          aria-label={`${rule.enabled ? "Disable" : "Enable"} ${rule.name}`}
                          title={rule.enabled ? "Disable rule" : "Enable rule"}
                          onClick={() =>
                            saveMutation.mutate({
                              id: rule.id,
                              rule: { ...rule, enabled: !rule.enabled },
                            })
                          }
                        >
                          <Power size={13} />
                        </button>
                        <button
                          aria-label={`Delete ${rule.name}`}
                          title="Delete rule"
                          onClick={() => deleteMutation.mutate(rule.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </article>
                    </div>
                  ))}
                </section>
                <form className="bgs-rule-form" onSubmit={submit}>
                  <header>
                    <BellRing size={19} />
                    <div>
                      <strong>{editingId ? "Edit rule" : "Create rule"}</strong>
                      <span>Influence values are percentage points.</span>
                    </div>
                  </header>
                  <label>
                    <span>Name</span>
                    <input
                      value={draft.name}
                      maxLength={160}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </label>
                  <div className="bgs-form-grid">
                    <label>
                      <span>Target</span>
                      <select
                        value={draft.target_scope}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            target_scope: event.target
                              .value as BgsRuleInput["target_scope"],
                            target_system:
                              event.target.value === "system"
                                ? (draft.target_system ?? systems[0] ?? null)
                                : null,
                          })
                        }
                      >
                        <option value="watchlist_all">
                          All watched systems
                        </option>
                        <option value="system">Single system</option>
                      </select>
                    </label>
                    {draft.target_scope === "system" && (
                      <label>
                        <span>System</span>
                        <select
                          value={draft.target_system ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              target_system: event.target.value,
                            })
                          }
                        >
                          <option value="">Select system</option>
                          {systems.map((system) => (
                            <option value={system} key={system}>
                              {system}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <label>
                    <span>Condition</span>
                    <select
                      value={draft.condition_type}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          condition_type: event.target
                            .value as BgsRuleInput["condition_type"],
                        })
                      }
                    >
                      {bgsRuleConditionOptions.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small>{condition?.description}</small>
                  </label>
                  <div className="bgs-form-grid">
                    <label>
                      <span>Threshold (pp)</span>
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={draft.threshold_pp}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            threshold_pp: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    {condition?.usesWindow && (
                      <label>
                        <span>Window (days)</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={draft.window_days}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              window_days: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span>Severity</span>
                      <select
                        value={draft.severity}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            severity: event.target
                              .value as BgsRuleInput["severity"],
                          })
                        }
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </label>
                  </div>
                  <fieldset>
                    <legend>Additional delivery</legend>
                    {scope === "personal" ? (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.personal_discord}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              personal_discord: event.target.checked,
                              tenant_discord: false,
                            })
                          }
                        />{" "}
                        Personal Discord webhook
                      </label>
                    ) : (
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.tenant_discord}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              tenant_discord: event.target.checked,
                              personal_discord: false,
                            })
                          }
                        />{" "}
                        Tenant BGS Discord webhook
                      </label>
                    )}
                    <small>Dashboard alerts are always created.</small>
                  </fieldset>
                  {(formError ||
                    saveMutation.isError ||
                    deleteMutation.isError) && (
                    <p className="form-error" role="alert">
                      {formError ||
                        saveMutation.error?.message ||
                        deleteMutation.error?.message}
                    </p>
                  )}
                  <footer>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => beginNew(scope)}
                    >
                      Reset
                    </button>
                    <button
                      className="primary-button"
                      disabled={saveMutation.isPending}
                    >
                      {editingId ? "Save changes" : "Create rule"}
                    </button>
                  </footer>
                </form>
              </div>
            </>
          ) : (
            <BgsRuleCatalog canManageTenant={canManageTenant} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

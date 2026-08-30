import { z } from "zod";

export const bgsRuleConditionTypes = [
  "controller_below",
  "controller_gap",
  "competitor_gain",
  "competitor_loss",
  "controller_loss",
  "tenant_faction_loss",
  "tenant_faction_new_conflict",
  "tenant_faction_below",
  "tenant_faction_gap",
] as const;

export type BgsRuleConditionType = (typeof bgsRuleConditionTypes)[number];
export type BgsRuleOwnerScope = "personal" | "tenant";
export type BgsRuleTargetScope = "system" | "watchlist_all";
export type BgsRuleTemplateTargetKind = "watchlist" | "protected_faction";
export type BgsSeverity = "info" | "warning" | "critical";
export type BgsAiReportType = "risk" | "strategy";

export const bgsRuleConditionOptions: Array<{
  value: BgsRuleConditionType;
  label: string;
  description: string;
  usesWindow: boolean;
}> = [
  {
    value: "controller_below",
    label: "Controller below threshold",
    description: "Controlling faction influence falls below the threshold.",
    usesWindow: false,
  },
  {
    value: "controller_gap",
    label: "Competitor closes the gap",
    description: "The leading competitor is at most the threshold behind.",
    usesWindow: false,
  },
  {
    value: "competitor_gain",
    label: "Competitor gains influence",
    description:
      "A non-controlling faction gains the threshold over the window.",
    usesWindow: true,
  },
  {
    value: "competitor_loss",
    label: "Competitor loses influence",
    description:
      "A non-controlling faction loses the threshold over the window.",
    usesWindow: true,
  },
  {
    value: "controller_loss",
    label: "Controller loses influence",
    description: "The controlling faction loses the threshold over the window.",
    usesWindow: true,
  },
  {
    value: "tenant_faction_loss",
    label: "Tenant faction loses influence",
    description:
      "The tenant faction loses the threshold since the previous settled BGS tick.",
    usesWindow: false,
  },
  {
    value: "tenant_faction_new_conflict",
    label: "Tenant faction enters a conflict",
    description: "The tenant faction enters a new Election or War.",
    usesWindow: false,
  },
  {
    value: "tenant_faction_below",
    label: "Tenant faction below threshold",
    description: "The tenant faction crosses below the influence threshold.",
    usesWindow: false,
  },
  {
    value: "tenant_faction_gap",
    label: "Faction closes the absolute gap",
    description:
      "Another faction moves within the absolute percentage-point gap.",
    usesWindow: false,
  },
];

export const bgsConditionSchema = z
  .object({
    type: z.enum(bgsRuleConditionTypes),
    threshold_pp: z.number().positive().max(100).optional(),
    window_days: z.number().int().min(1).max(30).optional(),
    comparison: z.literal("previous_settled_tick").optional(),
    gap_mode: z.literal("absolute").optional(),
    conflict_types: z
      .array(z.enum(["election", "war"]))
      .min(1)
      .optional(),
  })
  .superRefine((condition, context) => {
    if (
      condition.type !== "tenant_faction_new_conflict" &&
      condition.threshold_pp === undefined
    )
      context.addIssue({
        code: "custom",
        path: ["threshold_pp"],
        message: "A percentage-point threshold is required",
      });
    if (
      condition.type === "tenant_faction_new_conflict" &&
      !condition.conflict_types?.length
    )
      context.addIssue({
        code: "custom",
        path: ["conflict_types"],
        message: "Select Election or War",
      });
  });

export type BgsCondition = z.infer<typeof bgsConditionSchema>;

export const bgsRuleInputSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    owner_scope: z.enum(["personal", "tenant"]),
    target_scope: z.enum(["system", "watchlist_all"]),
    target_system: z.string().trim().max(255).nullable(),
    condition_type: z.enum(bgsRuleConditionTypes),
    threshold_pp: z.number().positive().max(100),
    window_days: z.number().int().min(1).max(30),
    severity: z.enum(["info", "warning", "critical"]),
    personal_discord: z.boolean(),
    tenant_discord: z.boolean(),
    enabled: z.boolean(),
    condition: bgsConditionSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.target_scope === "system" && !value.target_system)
      context.addIssue({
        code: "custom",
        path: ["target_system"],
        message: "Select a watched system",
      });
    if (value.owner_scope === "personal" && value.tenant_discord)
      context.addIssue({
        code: "custom",
        path: ["tenant_discord"],
        message: "Personal rules cannot use the tenant webhook",
      });
    if (value.owner_scope === "tenant" && value.personal_discord)
      context.addIssue({
        code: "custom",
        path: ["personal_discord"],
        message: "Tenant rules cannot use a personal webhook",
      });
  });

export type BgsRuleInput = z.infer<typeof bgsRuleInputSchema>;

export interface BgsRule extends BgsRuleInput {
  id: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  condition: BgsCondition;
  package_id: string | null;
  template_id: string | null;
  template_version: number | null;
  template_item_key: string | null;
  effective_from: string | null;
}

export const bgsRuleTemplateItemSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
  name: z.string().trim().min(3).max(160),
  condition: bgsConditionSchema,
  severity: z.enum(["info", "warning", "critical"]),
});

export const bgsRuleTemplateInputSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000),
  default_discord: z.boolean(),
  items: z.array(bgsRuleTemplateItemSchema).min(1).max(20),
  archived: z.boolean().optional(),
});

export type BgsRuleTemplateInput = z.infer<typeof bgsRuleTemplateInputSchema>;
export type BgsRuleTemplateItem = z.infer<typeof bgsRuleTemplateItemSchema>;

export interface BgsRulePackage {
  id: string;
  template_id: string;
  template_version: number;
  owner_scope: BgsRuleOwnerScope;
  owner_user_id: string | null;
  watchlist_scope: "personal" | "global" | "protected";
  protected_faction_id: number | null;
  protected_faction: ProtectedFactionSummary | null;
  personal_discord: boolean;
  tenant_discord: boolean;
  created_at: string;
  updated_at: string;
  rules: BgsRule[];
}

export interface BgsRuleTemplate extends BgsRuleTemplateInput {
  id: string;
  version: number;
  target_kind: BgsRuleTemplateTargetKind;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  packages: BgsRulePackage[];
}

export interface ProtectedFactionSummary {
  id: number;
  name: string;
  description: string;
  active: boolean;
  webhook_configured: boolean;
}

export interface BgsRuleCatalogPayload {
  data: BgsRuleTemplate[];
  discord_availability: { personal: boolean; global: boolean };
  can_manage_templates: boolean;
  can_apply_global: boolean;
  can_apply_protected: boolean;
  protected_factions: ProtectedFactionSummary[];
  generated_at: string;
}

export interface BgsAlert {
  id: string;
  rule_id: string | null;
  rule_name: string;
  owner_scope: BgsRuleOwnerScope;
  system_name: string;
  severity: BgsSeverity;
  title: string;
  message: string;
  facts: Record<string, unknown>;
  event_key: string;
  fired_ticktime: string;
  fired_at: string;
  resolved_at: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
}

export interface BgsAiReport {
  id: string;
  report_type: BgsAiReportType;
  system_name: string;
  requested_by?: string | null;
  tenant_faction: string;
  source_ticktime: string;
  model: string;
  status: "completed";
  report: Record<string, unknown>;
  source?: Record<string, unknown>;
  created_at: string;
}

export const defaultBgsRuleInput: BgsRuleInput = {
  name: "",
  owner_scope: "personal",
  target_scope: "system",
  target_system: null,
  condition_type: "controller_below",
  threshold_pp: 10,
  window_days: 1,
  severity: "warning",
  personal_discord: false,
  tenant_discord: false,
  enabled: true,
  condition: undefined,
};

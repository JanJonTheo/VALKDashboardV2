import { describe, expect, it } from "vitest";
import {
  bgsRuleInputSchema,
  bgsRuleTemplateInputSchema,
  defaultBgsRuleInput,
} from "@/lib/bgs-rules";

describe("BGS rule input", () => {
  it("accepts a personal single-system percentage-point rule", () => {
    const parsed = bgsRuleInputSchema.parse({
      ...defaultBgsRuleInput,
      name: "HIP 91987 controller guard",
      target_system: "HIP 91987",
      threshold_pp: 2.5,
    });
    expect(parsed.threshold_pp).toBe(2.5);
    expect(parsed.personal_discord).toBe(false);
  });

  it("requires a watched system for single-system rules", () => {
    expect(
      bgsRuleInputSchema.safeParse({
        ...defaultBgsRuleInput,
        name: "Missing target",
        target_system: null,
      }).success,
    ).toBe(false);
  });

  it("keeps personal and tenant Discord destinations isolated", () => {
    expect(
      bgsRuleInputSchema.safeParse({
        ...defaultBgsRuleInput,
        name: "Invalid destination",
        target_scope: "watchlist_all",
        tenant_discord: true,
      }).success,
    ).toBe(false);
    expect(
      bgsRuleInputSchema.safeParse({
        ...defaultBgsRuleInput,
        name: "Tenant rule",
        owner_scope: "tenant",
        target_scope: "watchlist_all",
        personal_discord: true,
      }).success,
    ).toBe(false);
  });

  it("limits settled-history windows to 30 days", () => {
    expect(
      bgsRuleInputSchema.safeParse({
        ...defaultBgsRuleInput,
        name: "Too much history",
        target_scope: "watchlist_all",
        condition_type: "controller_loss",
        window_days: 31,
      }).success,
    ).toBe(false);
  });

  it("validates the tenant-faction early-warning template shape", () => {
    const parsed = bgsRuleTemplateInputSchema.parse({
      name: "Tenant Faction Early Warning",
      description: "Four transition rules.",
      default_discord: true,
      items: [
        {
          key: "tenant-loss",
          name: "Tenant faction influence loss",
          condition: {
            type: "tenant_faction_loss",
            threshold_pp: 3,
            comparison: "previous_settled_tick",
          },
          severity: "warning",
        },
        {
          key: "tenant-conflict",
          name: "Tenant faction entered conflict",
          condition: {
            type: "tenant_faction_new_conflict",
            conflict_types: ["election", "war"],
          },
          severity: "warning",
        },
      ],
    });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.default_discord).toBe(true);
  });

  it("rejects a conflict template without Election or War", () => {
    expect(
      bgsRuleTemplateInputSchema.safeParse({
        name: "Invalid conflicts",
        description: "",
        default_discord: false,
        items: [
          {
            key: "conflict-rule",
            name: "Missing conflict type",
            condition: {
              type: "tenant_faction_new_conflict",
              conflict_types: [],
            },
            severity: "warning",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

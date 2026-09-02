import { z } from "zod";

export const preferenceSchemaVersion = 4;
export const maximumSavedViews = 20;

export const leaderboardMetricOptions = [
  { value: "missions", label: "Missions Completed" },
  { value: "missionFailures", label: "Missions Failed" },
  { value: "influence", label: "Influence" },
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "profit", label: "Profit" },
  { value: "volume", label: "Volume" },
  { value: "quantity", label: "Quantity" },
  { value: "bountyVouchers", label: "Bounty Vouchers" },
  { value: "combatBonds", label: "Combat Bonds" },
  { value: "explorationSales", label: "Exploration Sales" },
  { value: "bountyFines", label: "Bounty Fines" },
] as const;

export type LeaderboardMetric =
  (typeof leaderboardMetricOptions)[number]["value"];

export const evaluationChartModes = ["totals", "history"] as const;
export type EvaluationChartMode = (typeof evaluationChartModes)[number];

const sortingEntry = z.object({
  id: z.string().min(1).max(96),
  desc: z.boolean(),
});

const viewFilterValueSchema = z.union([
  z.string().max(512),
  z.array(z.string().max(512)).max(128),
]);

export const viewPreferenceSchema = z.object({
  search: z.string().max(512).optional(),
  period: z.string().max(32).optional(),
  metric: z
    .enum(leaderboardMetricOptions.map((option) => option.value))
    .optional(),
  chartMode: z.enum(evaluationChartModes).optional(),
  filters: z.record(z.string(), viewFilterValueSchema).default({}),
  variant: z.string().max(64).optional(),
  sorting: z.array(sortingEntry).max(8).default([]),
  visibleColumns: z.array(z.string().max(96)).max(64).default([]),
  pageSize: z.number().int().min(10).max(250).default(25),
});

export const savedViewSchema = z.object({
  id: z.string().min(1).max(96),
  name: z.string().trim().min(1).max(64),
  view: viewPreferenceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const viewCollectionSchema = z
  .object({
    current: viewPreferenceSchema,
    activeViewId: z.string().min(1).max(96).nullable().default(null),
    views: z.array(savedViewSchema).max(maximumSavedViews).default([]),
  })
  .superRefine((collection, context) => {
    const names = new Set<string>();
    for (const view of collection.views) {
      const normalized = view.name.toLocaleLowerCase("en");
      if (names.has(normalized)) {
        context.addIssue({
          code: "custom",
          message: "Saved view names must be unique",
          path: ["views"],
        });
      }
      names.add(normalized);
    }
    if (
      collection.activeViewId &&
      !collection.views.some((view) => view.id === collection.activeViewId)
    ) {
      context.addIssue({
        code: "custom",
        message: "The active saved view does not exist",
        path: ["activeViewId"],
      });
    }
  });

export type ViewPreference = z.infer<typeof viewPreferenceSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;
export type ViewCollection = z.infer<typeof viewCollectionSchema>;
export type ViewFilterValue = ViewPreference["filters"][string];

export function viewFilterValues(value: ViewFilterValue | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function viewFilterString(value: ViewFilterValue | undefined) {
  return viewFilterValues(value)[0] ?? "";
}

export function defaultViewPreference(
  viewKey: string,
  columnKeys: readonly string[],
): ViewPreference {
  if (viewKey === "leaderboard") {
    return {
      period: "cm",
      metric: "missions",
      filters: {},
      variant: undefined,
      sorting: [{ id: "missions", desc: true }],
      visibleColumns: [...columnKeys],
      pageSize: 25,
    };
  }
  if (viewKey === "evaluations") {
    return {
      period: "all",
      metric: "missions",
      chartMode: "totals",
      filters: {},
      variant: "full",
      sorting: [{ id: "missions", desc: true }],
      visibleColumns: [...columnKeys],
      pageSize: 25,
    };
  }
  return {
    filters: {},
    sorting: [],
    visibleColumns: [...columnKeys],
    pageSize: 25,
  };
}

export function preferencePayload(value: unknown): ViewPreference | null {
  const parsed = viewPreferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function defaultViewCollection(current: ViewPreference): ViewCollection {
  return { current, activeViewId: null, views: [] };
}

export function viewCollectionPayload(
  value: unknown,
  fallback: ViewPreference,
): ViewCollection {
  const collection = viewCollectionSchema.safeParse(value);
  if (collection.success) return collection.data;
  if (typeof value === "object" && value !== null && "current" in value) {
    const current = preferencePayload((value as { current?: unknown }).current);
    return defaultViewCollection(current ?? fallback);
  }
  const legacy = preferencePayload(value);
  return defaultViewCollection(legacy ?? fallback);
}

export function viewPreferencesEqual(
  left: ViewPreference,
  right: ViewPreference,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

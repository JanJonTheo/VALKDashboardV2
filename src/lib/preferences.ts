import { z } from "zod";

export const preferenceSchemaVersion = 1;

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

const sortingEntry = z.object({
  id: z.string().min(1).max(96),
  desc: z.boolean(),
});

export const viewPreferenceSchema = z.object({
  period: z.string().max(32).optional(),
  metric: z
    .enum(leaderboardMetricOptions.map((option) => option.value))
    .optional(),
  filters: z.record(z.string(), z.string().max(512)).default({}),
  variant: z.string().max(64).optional(),
  sorting: z.array(sortingEntry).max(8).default([]),
  visibleColumns: z.array(z.string().max(96)).max(64).default([]),
  pageSize: z.number().int().min(10).max(250).default(25),
});

export type ViewPreference = z.infer<typeof viewPreferenceSchema>;

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

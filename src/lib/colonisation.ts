export interface ColonisationContributor {
  cmdr: string;
  delivered: number;
}

export interface ColonisationCommodity {
  key: string;
  commodity: string;
  need: number;
  delivered: number;
  diff: number;
  unrecorded: number;
  contributors: ColonisationContributor[];
}

export interface ColonisationConstruction {
  id: string;
  construction: string;
  status: string;
  system: string;
  need: number;
  delivered: number;
  diff: number;
  commodities: ColonisationCommodity[];
}

export interface ColonisationCommodityRow {
  commodity: ColonisationCommodity;
  delivered: number;
  diff: number;
}

export interface ColonisationCommanderGroup {
  cmdr: string;
  need: number;
  delivered: number;
  diff: number;
  commodities: ColonisationCommodityRow[];
}

export interface ColonisationCommodityContribution {
  cmdr: string;
  delivered: number;
}

export interface ColonisationCommodityGroup {
  commodity: ColonisationCommodity;
  contributions: ColonisationCommodityContribution[];
}

export interface ColonisationContributionCommodity {
  key: string;
  commodity: string;
  delivered: number;
  events: number;
}

export interface ColonisationContributionConstruction {
  id: string;
  construction: string;
  system: string;
  delivered: number;
  events: number;
  commodities: ColonisationContributionCommodity[];
}

export interface ColonisationContributionGroup {
  id: string;
  cmdr: string;
  delivered: number;
  events: number;
  commodities: ColonisationContributionCommodity[];
  constructions: ColonisationContributionConstruction[];
}

type Row = Record<string, unknown>;

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const text = (value: unknown) => String(value ?? "").trim();

const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Row => Boolean(entry) && typeof entry === "object",
      )
    : [];

export function normalizeColonisationConstructions(
  value: unknown,
): ColonisationConstruction[] {
  return rows(value).map((entry, constructionIndex) => {
    const commodities = rows(entry.commodities).map(
      (item, commodityIndex): ColonisationCommodity => {
        const need = number(item.need ?? item.required);
        const delivered = number(item.provided ?? item.delivered);
        const contributors = rows(item.contributors).map((contributor) => ({
          cmdr: text(contributor.cmdr) || "Unknown Cmdr",
          delivered: number(contributor.quantity ?? contributor.delivered),
        }));
        const recorded = contributors.reduce(
          (total, contributor) => total + contributor.delivered,
          0,
        );
        return {
          key:
            text(item.commodity_key) ||
            text(item.commodity) ||
            `commodity-${commodityIndex}`,
          commodity: text(item.commodity) || "Unknown commodity",
          need,
          delivered,
          diff: number(item.remaining ?? Math.max(0, need - delivered)),
          unrecorded: number(
            item.unrecorded_quantity ?? Math.max(0, delivered - recorded),
          ),
          contributors,
        };
      },
    );
    const commodityNeed = commodities.reduce(
      (total, commodity) => total + commodity.need,
      0,
    );
    const commodityDelivered = commodities.reduce(
      (total, commodity) => total + commodity.delivered,
      0,
    );
    const need = number(entry.total_need ?? commodityNeed);
    const delivered = number(entry.total_provided ?? commodityDelivered);
    return {
      id:
        text(entry.market_id ?? entry.key) ||
        `construction-${constructionIndex}`,
      construction:
        text(entry.label ?? entry.construction ?? entry.target_name) ||
        "Unknown construction",
      status: text(entry.status) || "unknown",
      system: text(entry.target_system),
      need,
      delivered,
      diff: number(entry.total_remaining ?? Math.max(0, need - delivered)),
      commodities,
    };
  });
}

function normalizeContributionCommodities(
  value: unknown,
): ColonisationContributionCommodity[] {
  return rows(value).map((item, index) => ({
    key:
      text(item.commodity_key) || text(item.commodity) || `commodity-${index}`,
    commodity: text(item.commodity) || "Unknown commodity",
    delivered: number(item.quantity ?? item.delivered),
    events: number(item.event_count ?? item.events),
  }));
}

export function normalizeColonisationContributionGroups(
  value: unknown,
): ColonisationContributionGroup[] {
  return rows(value).map((group, groupIndex) => ({
    id: text(group.key) || `cmdr-${groupIndex}`,
    cmdr: text(group.cmdr ?? group.label) || "Unknown Cmdr",
    delivered: number(group.quantity ?? group.delivered),
    events: number(group.event_count ?? group.events),
    commodities: normalizeContributionCommodities(group.commodities),
    constructions: rows(group.subgroups).map((construction, index) => ({
      id:
        text(construction.market_id ?? construction.key) ||
        `construction-${index}`,
      construction:
        text(construction.label ?? construction.construction) ||
        "Unknown construction",
      system: text(construction.target_system),
      delivered: number(construction.quantity ?? construction.delivered),
      events: number(construction.event_count ?? construction.events),
      commodities: normalizeContributionCommodities(construction.commodities),
    })),
  }));
}

export function filterColonisationContributionGroups(
  groups: ColonisationContributionGroup[],
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups.filter(
    (group) =>
      group.cmdr.toLowerCase().includes(needle) ||
      group.commodities.some((commodity) =>
        commodity.commodity.toLowerCase().includes(needle),
      ) ||
      group.constructions.some(
        (construction) =>
          construction.construction.toLowerCase().includes(needle) ||
          construction.system.toLowerCase().includes(needle) ||
          construction.commodities.some((commodity) =>
            commodity.commodity.toLowerCase().includes(needle),
          ),
      ),
  );
}

export function contributionCommodityNames(
  groups: ColonisationContributionGroup[],
) {
  return [
    ...new Set(
      groups.flatMap((group) =>
        group.commodities.map((commodity) => commodity.commodity),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function filterColonisationConstructions(
  constructions: ColonisationConstruction[],
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return constructions;
  return constructions.filter(
    (construction) =>
      construction.construction.toLowerCase().includes(needle) ||
      construction.system.toLowerCase().includes(needle) ||
      construction.status.toLowerCase().includes(needle) ||
      construction.commodities.some(
        (commodity) =>
          commodity.commodity.toLowerCase().includes(needle) ||
          commodity.contributors.some((contributor) =>
            contributor.cmdr.toLowerCase().includes(needle),
          ),
      ),
  );
}

export function colonisationCommanderGroups(
  construction: ColonisationConstruction,
): ColonisationCommanderGroup[] {
  const groups = new Map<string, ColonisationCommodityRow[]>();

  function add(
    cmdr: string,
    commodity: ColonisationCommodity,
    delivered: number,
  ) {
    const current = groups.get(cmdr) ?? [];
    const existing = current.find((row) => row.commodity.key === commodity.key);
    if (existing) {
      existing.delivered += delivered;
      existing.diff = Math.max(0, commodity.need - existing.delivered);
    } else {
      current.push({
        commodity,
        delivered,
        diff: Math.max(0, commodity.need - delivered),
      });
    }
    groups.set(cmdr, current);
  }

  for (const commodity of construction.commodities) {
    for (const contributor of commodity.contributors)
      add(contributor.cmdr, commodity, contributor.delivered);

    if (commodity.unrecorded > 0)
      add("Unattributed deliveries", commodity, commodity.unrecorded);
    else if (commodity.contributors.length === 0)
      add("No recorded Cmdr", commodity, commodity.delivered);
  }

  return [...groups.entries()]
    .map(([cmdr, commodities]) => {
      const uniqueNeed = new Map<string, number>();
      for (const row of commodities)
        uniqueNeed.set(row.commodity.key, row.commodity.need);
      const need = [...uniqueNeed.values()].reduce(
        (total, value) => total + value,
        0,
      );
      const delivered = commodities.reduce(
        (total, row) => total + row.delivered,
        0,
      );
      return {
        cmdr,
        need,
        delivered,
        diff: Math.max(0, need - delivered),
        commodities: commodities.sort((left, right) =>
          left.commodity.commodity.localeCompare(right.commodity.commodity),
        ),
      };
    })
    .sort((left, right) => {
      const leftUnattributed =
        left.cmdr.startsWith("Unattributed") ||
        left.cmdr.startsWith("No recorded");
      const rightUnattributed =
        right.cmdr.startsWith("Unattributed") ||
        right.cmdr.startsWith("No recorded");
      if (leftUnattributed !== rightUnattributed)
        return leftUnattributed ? 1 : -1;
      return (
        right.delivered - left.delivered || left.cmdr.localeCompare(right.cmdr)
      );
    });
}

export function colonisationCommodityGroups(
  construction: ColonisationConstruction,
): ColonisationCommodityGroup[] {
  return construction.commodities
    .map((commodity) => {
      const contributions = new Map<string, number>();
      for (const contributor of commodity.contributors) {
        contributions.set(
          contributor.cmdr,
          (contributions.get(contributor.cmdr) ?? 0) + contributor.delivered,
        );
      }
      if (commodity.unrecorded > 0) {
        contributions.set(
          "Unattributed deliveries",
          (contributions.get("Unattributed deliveries") ?? 0) +
            commodity.unrecorded,
        );
      } else if (contributions.size === 0 && commodity.delivered > 0) {
        contributions.set("No recorded Cmdr", commodity.delivered);
      }

      return {
        commodity,
        contributions: [...contributions.entries()]
          .map(([cmdr, delivered]) => ({ cmdr, delivered }))
          .sort((left, right) => {
            const leftUnattributed =
              left.cmdr.startsWith("Unattributed") ||
              left.cmdr.startsWith("No recorded");
            const rightUnattributed =
              right.cmdr.startsWith("Unattributed") ||
              right.cmdr.startsWith("No recorded");
            if (leftUnattributed !== rightUnattributed)
              return leftUnattributed ? 1 : -1;
            return (
              right.delivered - left.delivered ||
              left.cmdr.localeCompare(right.cmdr)
            );
          }),
      };
    })
    .sort((left, right) =>
      left.commodity.commodity.localeCompare(right.commodity.commodity),
    );
}

export function colonisationCommodityNames(
  constructions: ColonisationConstruction[],
) {
  return [
    ...new Set(
      constructions.flatMap((construction) =>
        construction.commodities.map((commodity) => commodity.commodity),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

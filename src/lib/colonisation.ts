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
  status: string;
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

export interface ColonisationContributionRecord {
  id: string;
  eventId: string;
  timestamp: string;
  tickId: string;
  tickTime: string;
  cmdr: string;
  commodity: string;
  commodityKey: string;
  delivered: number;
  constructionId: string;
  construction: string;
  system: string;
  status: string;
}

export interface ColonisationRecordCommanderGroup {
  id: string;
  cmdr: string;
  delivered: number;
  records: ColonisationContributionRecord[];
}

export interface ColonisationRecordConstructionGroup {
  id: string;
  construction: string;
  system: string;
  status: string;
  delivered: number;
  records: ColonisationContributionRecord[];
  commanders: ColonisationRecordCommanderGroup[];
}

export interface ColonisationFilterValues {
  cmdr?: string[];
  status?: string;
  system?: string;
  commodity?: string[];
  commodityDiff?: string;
  fromDate?: string;
  toDate?: string;
}

export const COLONISATION_UNATTRIBUTED_CMDR = "Unattributed deliveries";

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
  constructions: ColonisationConstruction[] = [],
): ColonisationContributionGroup[] {
  const constructionById = new Map(
    constructions.map((construction) => [construction.id, construction]),
  );
  return rows(value).map((group, groupIndex) => ({
    id: text(group.key) || `cmdr-${groupIndex}`,
    cmdr: text(group.cmdr ?? group.label) || "Unknown Cmdr",
    delivered: number(group.quantity ?? group.delivered),
    events: number(group.event_count ?? group.events),
    commodities: normalizeContributionCommodities(group.commodities),
    constructions: rows(group.subgroups).map((construction, index) => {
      const id =
        text(construction.market_id ?? construction.key) ||
        `construction-${index}`;
      const snapshot = constructionById.get(id);
      return {
        id,
        construction:
          text(construction.label ?? construction.construction) ||
          snapshot?.construction ||
          "Unknown construction",
        system: text(construction.target_system) || snapshot?.system || "",
        status: text(construction.status) || snapshot?.status || "unknown",
        delivered: number(construction.quantity ?? construction.delivered),
        events: number(construction.event_count ?? construction.events),
        commodities: normalizeContributionCommodities(construction.commodities),
      };
    }),
  }));
}

export function normalizeColonisationContributionRecords(
  value: unknown,
  constructions: ColonisationConstruction[] = [],
): ColonisationContributionRecord[] {
  const constructionById = new Map(
    constructions.map((construction) => [construction.id, construction]),
  );
  return rows(value).map((record, index) => {
    const constructionId =
      text(record.market_id ?? record.construction_key) ||
      `construction-${index}`;
    const snapshot = constructionById.get(constructionId);
    const eventId = text(record.event_id) || `event-${index}`;
    const commodityKey =
      text(record.commodity_key) || text(record.commodity) || "unknown";
    return {
      id: `${eventId}-${commodityKey}-${index}`,
      eventId,
      timestamp: text(record.timestamp),
      tickId: text(record.tickid),
      tickTime: text(record.ticktime),
      cmdr: text(record.cmdr) || "Unknown Cmdr",
      commodity: text(record.commodity) || "Unknown commodity",
      commodityKey,
      delivered: number(record.quantity ?? record.delivered),
      constructionId,
      construction:
        text(record.construction ?? record.target_name) ||
        snapshot?.construction ||
        "Unknown construction",
      system:
        text(record.target_system ?? record.system) || snapshot?.system || "",
      status: text(record.status) || snapshot?.status || "unknown",
    };
  });
}

function contributionRecordCommodityIdentity(
  constructionId: string,
  commodityKey: string,
) {
  return `${constructionId.trim().toLowerCase()}\u0000${commodityKey
    .trim()
    .toLowerCase()}`;
}

export function includeUnattributedColonisationContributionRecords(
  records: ColonisationContributionRecord[],
  constructions: ColonisationConstruction[],
): ColonisationContributionRecord[] {
  const existingUnattributed = new Map<string, number>();
  for (const record of records) {
    if (
      record.cmdr.toLowerCase() !== COLONISATION_UNATTRIBUTED_CMDR.toLowerCase()
    )
      continue;
    const identity = contributionRecordCommodityIdentity(
      record.constructionId,
      record.commodityKey,
    );
    existingUnattributed.set(
      identity,
      (existingUnattributed.get(identity) ?? 0) + record.delivered,
    );
  }

  const syntheticRecords: ColonisationContributionRecord[] = [];
  for (const construction of constructions) {
    for (const commodity of construction.commodities) {
      const identity = contributionRecordCommodityIdentity(
        construction.id,
        commodity.key,
      );
      const delivered = Math.max(
        0,
        commodity.unrecorded - (existingUnattributed.get(identity) ?? 0),
      );
      if (delivered === 0) continue;
      syntheticRecords.push({
        id: `unattributed:${construction.id}:${commodity.key}`,
        eventId: "unattributed",
        timestamp: "",
        tickId: "",
        tickTime: "",
        cmdr: COLONISATION_UNATTRIBUTED_CMDR,
        commodity: commodity.commodity,
        commodityKey: commodity.key,
        delivered,
        constructionId: construction.id,
        construction: construction.construction,
        system: construction.system,
        status: construction.status,
      });
    }
  }

  return syntheticRecords.length === 0
    ? records
    : [...records, ...syntheticRecords];
}

export function includeUnattributedColonisationContributionGroups(
  groups: ColonisationContributionGroup[],
  constructions: ColonisationConstruction[],
): ColonisationContributionGroup[] {
  const next = groups.map((group) => ({
    ...group,
    commodities: group.commodities.map((commodity) => ({ ...commodity })),
    constructions: group.constructions.map((construction) => ({
      ...construction,
      commodities: construction.commodities.map((commodity) => ({
        ...commodity,
      })),
    })),
  }));
  let unattributed = next.find(
    (group) =>
      group.cmdr.toLowerCase() === COLONISATION_UNATTRIBUTED_CMDR.toLowerCase(),
  );
  if (!unattributed) {
    unattributed = {
      id: "unattributed-deliveries",
      cmdr: COLONISATION_UNATTRIBUTED_CMDR,
      delivered: 0,
      events: 0,
      commodities: [],
      constructions: [],
    };
    next.push(unattributed);
  }

  for (const construction of constructions) {
    let targetConstruction = unattributed.constructions.find(
      (candidate) => candidate.id === construction.id,
    );
    for (const commodity of construction.commodities) {
      const recorded =
        targetConstruction?.commodities.find(
          (candidate) => candidate.key === commodity.key,
        )?.delivered ?? 0;
      const missing = Math.max(0, commodity.unrecorded - recorded);
      if (missing === 0) continue;
      if (!targetConstruction) {
        targetConstruction = {
          id: construction.id,
          construction: construction.construction,
          system: construction.system,
          status: construction.status,
          delivered: 0,
          events: 0,
          commodities: [],
        };
        unattributed.constructions.push(targetConstruction);
      }
      const targetCommodity = targetConstruction.commodities.find(
        (candidate) => candidate.key === commodity.key,
      );
      if (targetCommodity) targetCommodity.delivered += missing;
      else
        targetConstruction.commodities.push({
          key: commodity.key,
          commodity: commodity.commodity,
          delivered: missing,
          events: 0,
        });
    }
  }

  unattributed.constructions = unattributed.constructions
    .map((construction) => ({
      ...construction,
      delivered: construction.commodities.reduce(
        (total, commodity) => total + commodity.delivered,
        0,
      ),
    }))
    .filter((construction) => construction.delivered > 0);
  const commodities = new Map<string, ColonisationContributionCommodity>();
  for (const construction of unattributed.constructions) {
    for (const commodity of construction.commodities) {
      const current = commodities.get(commodity.key) ?? {
        ...commodity,
        delivered: 0,
        events: 0,
      };
      current.delivered += commodity.delivered;
      current.events += commodity.events;
      commodities.set(commodity.key, current);
    }
  }
  unattributed.commodities = [...commodities.values()];
  unattributed.delivered = unattributed.commodities.reduce(
    (total, commodity) => total + commodity.delivered,
    0,
  );
  unattributed.events = unattributed.constructions.reduce(
    (total, construction) => total + construction.events,
    0,
  );

  return unattributed.delivered > 0
    ? next
    : next.filter((group) => group !== unattributed);
}

function exactMatch(value: string, filter: string | undefined) {
  const needle = filter?.trim().toLowerCase();
  return !needle || value.toLowerCase() === needle;
}

function matchesAny(value: string, filters: string[] | undefined) {
  if (!filters?.length) return true;
  const candidate = value.toLowerCase();
  return filters.some((filter) => candidate === filter.trim().toLowerCase());
}

export function colonisationConstructionStatus(value: string) {
  return /^(complete|completed|closed|done|finished)$/i.test(value.trim())
    ? "finished"
    : "open";
}

function matchesConstructionStatus(value: string, filter: string | undefined) {
  return !filter || colonisationConstructionStatus(value) === filter;
}

function hasCommodityDiffFilter(filter: string | undefined) {
  return filter === "yes" || filter === "no";
}

function matchesCommodityDiff(
  diff: number | undefined,
  filter: string | undefined,
) {
  if (!hasCommodityDiffFilter(filter)) return true;
  if (diff === undefined) return false;
  return filter === "yes" ? diff > 0 : diff === 0;
}

// Always use the Construction snapshot, not a commander's partial deliveries.
function commodityDiffLookup(constructions: ColonisationConstruction[]) {
  const diffs = new Map<string, number>();
  for (const construction of constructions) {
    for (const commodity of construction.commodities) {
      for (const key of [commodity.key, commodity.commodity])
        diffs.set(
          contributionRecordCommodityIdentity(construction.id, key),
          commodity.diff,
        );
    }
  }
  return (constructionId: string, key: string, name: string) =>
    diffs.get(contributionRecordCommodityIdentity(constructionId, key)) ??
    diffs.get(contributionRecordCommodityIdentity(constructionId, name));
}

function recordMatchesDate(
  timestamp: string,
  fromDate?: string,
  toDate?: string,
) {
  const date = timestamp.slice(0, 10);
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

export function filterColonisationContributionRecords(
  records: ColonisationContributionRecord[],
  query: string,
  filters: ColonisationFilterValues = {},
  constructions: ColonisationConstruction[] = [],
) {
  const needle = query.trim().toLowerCase();
  const commodityDiff = commodityDiffLookup(constructions);
  return records.filter(
    (record) =>
      matchesAny(record.cmdr, filters.cmdr) &&
      matchesConstructionStatus(record.status, filters.status) &&
      exactMatch(record.system, filters.system) &&
      matchesAny(record.commodity, filters.commodity) &&
      matchesCommodityDiff(
        commodityDiff(
          record.constructionId,
          record.commodityKey,
          record.commodity,
        ),
        filters.commodityDiff,
      ) &&
      recordMatchesDate(record.timestamp, filters.fromDate, filters.toDate) &&
      (!needle ||
        [
          record.construction,
          record.cmdr,
          record.status,
          record.system,
          record.commodity,
          record.timestamp,
          record.tickId,
        ].some((value) => value.toLowerCase().includes(needle))),
  );
}

export function groupColonisationContributionRecords(
  records: ColonisationContributionRecord[],
): ColonisationRecordConstructionGroup[] {
  const constructions = new Map<
    string,
    {
      construction: string;
      system: string;
      status: string;
      records: ColonisationContributionRecord[];
    }
  >();

  for (const record of records) {
    const construction = constructions.get(record.constructionId) ?? {
      construction: record.construction,
      system: record.system,
      status: record.status,
      records: [],
    };
    construction.records.push(record);
    constructions.set(record.constructionId, construction);
  }

  return [...constructions.entries()]
    .map(([id, construction]) => {
      const commanders = new Map<string, ColonisationContributionRecord[]>();
      for (const record of construction.records) {
        const cmdrRecords = commanders.get(record.cmdr) ?? [];
        cmdrRecords.push(record);
        commanders.set(record.cmdr, cmdrRecords);
      }
      const recordsAscending = [...construction.records].sort((left, right) =>
        left.timestamp.localeCompare(right.timestamp),
      );
      return {
        id,
        construction: construction.construction,
        system: construction.system,
        status: construction.status,
        delivered: construction.records.reduce(
          (total, record) => total + record.delivered,
          0,
        ),
        records: recordsAscending,
        commanders: [...commanders.entries()]
          .map(([cmdr, cmdrRecords]) => ({
            id: `${id}:${cmdr.toLowerCase()}`,
            cmdr,
            delivered: cmdrRecords.reduce(
              (total, record) => total + record.delivered,
              0,
            ),
            records: [...cmdrRecords].sort((left, right) =>
              left.timestamp.localeCompare(right.timestamp),
            ),
          }))
          .sort((left, right) =>
            (left.records[0]?.timestamp ?? "").localeCompare(
              right.records[0]?.timestamp ?? "",
            ),
          ),
      };
    })
    .sort((left, right) =>
      (left.records[0]?.timestamp ?? "").localeCompare(
        right.records[0]?.timestamp ?? "",
      ),
    );
}

function validRecordTime(timestamp: string) {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? value : undefined;
}

function lastRecordTimes(
  records: ColonisationContributionRecord[],
  identity: (record: ColonisationContributionRecord) => string,
) {
  const last = new Map<string, number>();
  for (const record of records) {
    const timestamp = validRecordTime(record.timestamp);
    if (timestamp === undefined) continue;
    const key = identity(record).toLowerCase();
    last.set(key, Math.max(last.get(key) ?? timestamp, timestamp));
  }
  return last;
}

function compareLastSeen(
  leftTime: number | undefined,
  rightTime: number | undefined,
  leftName: string,
  rightName: string,
) {
  if (leftTime === undefined && rightTime !== undefined) return 1;
  if (leftTime !== undefined && rightTime === undefined) return -1;
  if (leftTime !== rightTime) return (rightTime ?? 0) - (leftTime ?? 0);
  return leftName.localeCompare(rightName, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function visualAnalysisConstructions(
  constructions: ColonisationConstruction[],
  records: ColonisationContributionRecord[],
  limit: number,
) {
  const last = lastRecordTimes(records, (record) => record.constructionId);
  return [...constructions]
    .sort((left, right) =>
      compareLastSeen(
        last.get(left.id.toLowerCase()),
        last.get(right.id.toLowerCase()),
        left.construction,
        right.construction,
      ),
    )
    .slice(0, limit);
}

export function visualAnalysisContributionGroups(
  groups: ColonisationContributionGroup[],
  records: ColonisationContributionRecord[],
  limit: number,
) {
  const last = lastRecordTimes(records, (record) => record.cmdr);
  return [...groups]
    .sort((left, right) =>
      compareLastSeen(
        last.get(left.cmdr.toLowerCase()),
        last.get(right.cmdr.toLowerCase()),
        left.cmdr,
        right.cmdr,
      ),
    )
    .slice(0, limit);
}

export function filterColonisationContributionGroups(
  groups: ColonisationContributionGroup[],
  query: string,
  filters: ColonisationFilterValues = {},
  snapshots: ColonisationConstruction[] = [],
) {
  const needle = query.trim().toLowerCase();
  const commodityDiff = commodityDiffLookup(snapshots);
  return groups
    .filter((group) => matchesAny(group.cmdr, filters.cmdr))
    .map((group) => {
      const constructions = group.constructions
        .filter(
          (construction) =>
            matchesConstructionStatus(construction.status, filters.status) &&
            exactMatch(construction.system, filters.system),
        )
        .map((construction) => {
          const commodities = construction.commodities.filter(
            (commodity) =>
              matchesAny(commodity.commodity, filters.commodity) &&
              matchesCommodityDiff(
                commodityDiff(
                  construction.id,
                  commodity.key,
                  commodity.commodity,
                ),
                filters.commodityDiff,
              ),
          );
          return {
            ...construction,
            commodities,
            delivered: commodities.reduce(
              (total, commodity) => total + commodity.delivered,
              0,
            ),
          };
        })
        .filter(
          (construction) =>
            (!filters.commodity?.length &&
              !hasCommodityDiffFilter(filters.commodityDiff)) ||
            construction.commodities.length > 0,
        );
      const commodityMap = new Map<string, ColonisationContributionCommodity>();
      for (const construction of constructions) {
        for (const commodity of construction.commodities) {
          const current = commodityMap.get(commodity.key) ?? {
            ...commodity,
            delivered: 0,
            events: 0,
          };
          current.delivered += commodity.delivered;
          current.events += commodity.events;
          commodityMap.set(commodity.key, current);
        }
      }
      const commodities = [...commodityMap.values()].sort((left, right) =>
        left.commodity.localeCompare(right.commodity),
      );
      return {
        ...group,
        constructions,
        commodities,
        delivered: commodities.reduce(
          (total, commodity) => total + commodity.delivered,
          0,
        ),
        events: constructions.reduce(
          (total, construction) => total + construction.events,
          0,
        ),
      };
    })
    .filter(
      (group) =>
        group.constructions.length > 0 &&
        (!needle ||
          group.cmdr.toLowerCase().includes(needle) ||
          group.commodities.some((commodity) =>
            commodity.commodity.toLowerCase().includes(needle),
          ) ||
          group.constructions.some(
            (construction) =>
              construction.construction.toLowerCase().includes(needle) ||
              construction.system.toLowerCase().includes(needle) ||
              construction.status.toLowerCase().includes(needle) ||
              construction.commodities.some((commodity) =>
                commodity.commodity.toLowerCase().includes(needle),
              ),
          )),
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
  filters: ColonisationFilterValues = {},
) {
  const needle = query.trim().toLowerCase();
  return constructions
    .filter(
      (construction) =>
        matchesConstructionStatus(construction.status, filters.status) &&
        exactMatch(construction.system, filters.system),
    )
    .map((construction) => {
      const commodities = construction.commodities
        .filter(
          (commodity) =>
            matchesAny(commodity.commodity, filters.commodity) &&
            matchesCommodityDiff(commodity.diff, filters.commodityDiff),
        )
        .map((commodity) => {
          if (!filters.cmdr?.length) return commodity;
          const contributors = commodity.contributors.filter((contributor) =>
            matchesAny(contributor.cmdr, filters.cmdr),
          );
          const includeUnattributed = filters.cmdr.some(
            (cmdr) =>
              cmdr.toLowerCase() ===
              COLONISATION_UNATTRIBUTED_CMDR.toLowerCase(),
          );
          const unrecorded = includeUnattributed ? commodity.unrecorded : 0;
          const delivered =
            contributors.reduce(
              (total, contributor) => total + contributor.delivered,
              0,
            ) + unrecorded;
          return {
            ...commodity,
            delivered,
            diff: Math.max(0, commodity.need - delivered),
            unrecorded,
            contributors,
          };
        })
        .filter(
          (commodity) =>
            !filters.cmdr?.length ||
            commodity.contributors.length > 0 ||
            commodity.unrecorded > 0,
        );
      const scoped = Boolean(
        filters.cmdr?.length ||
        filters.commodity?.length ||
        hasCommodityDiffFilter(filters.commodityDiff),
      );
      if (!scoped) return construction;
      return {
        ...construction,
        commodities,
      };
    })
    .filter(
      (construction) =>
        (!filters.cmdr?.length &&
          !filters.commodity?.length &&
          !hasCommodityDiffFilter(filters.commodityDiff)) ||
        construction.commodities.length > 0,
    )
    .filter(
      (construction) =>
        !needle ||
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

export interface ColonisationCommodityConstructionGroup {
  key: string;
  commodity: string;
  need: number;
  delivered: number;
  diff: number;
  constructions: {
    construction: ColonisationConstruction;
    commodity: ColonisationCommodity;
  }[];
}

export function groupColonisationCommodities(
  constructions: ColonisationConstruction[],
): ColonisationCommodityConstructionGroup[] {
  const groups = new Map<string, ColonisationCommodityConstructionGroup>();
  for (const construction of constructions) {
    for (const commodity of construction.commodities) {
      const key = commodity.key.trim().toLowerCase();
      const group = groups.get(key) ?? {
        key,
        commodity: commodity.commodity,
        need: 0,
        delivered: 0,
        diff: 0,
        constructions: [],
      };
      group.need += commodity.need;
      group.delivered += commodity.delivered;
      group.diff += commodity.diff;
      group.constructions.push({ construction, commodity });
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((left, right) =>
    left.commodity.localeCompare(right.commodity),
  );
}

export function colonisationTotals(
  groups: { need?: number; delivered: number; diff?: number }[],
) {
  return groups.reduce<{ need: number; delivered: number; diff: number }>(
    (total, group) => ({
      need: total.need + (group.need ?? 0),
      delivered: total.delivered + group.delivered,
      diff: total.diff + (group.diff ?? 0),
    }),
    { need: 0, delivered: 0, diff: 0 },
  );
}

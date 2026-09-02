"use client";

import ReactECharts from "echarts-for-react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Atom,
  Beaker,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  CircleDashed,
  Cpu,
  Forklift,
  Package,
  Shield,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type ReactNode, useMemo } from "react";
import {
  colonisationCommanderGroups,
  colonisationCommodityGroups,
  colonisationCommodityNames,
  colonisationConstructionStatus,
  colonisationTotals,
  contributionCommodityNames,
  type ColonisationConstruction,
  type ColonisationCommodityConstructionGroup,
  type ColonisationContributionCommodity,
  type ColonisationContributionGroup,
  type ColonisationContributionRecord,
  type ColonisationRecordCommanderGroup,
  type ColonisationRecordConstructionGroup,
} from "@/lib/colonisation";
import { formatValue } from "@/lib/utils";
import { CopyTextButton } from "./copy-text-button";

const commodityColours = [
  "#e8bd52",
  "#70b7d6",
  "#7bc69a",
  "#d58a67",
  "#a892d7",
  "#d77088",
  "#62c4bb",
  "#d3a66a",
  "#86a7d8",
  "#b4c96f",
  "#c47bc0",
  "#e08369",
  "#6fcae0",
  "#a9a0df",
  "#dfc873",
  "#68a9a1",
  "#cf8fbc",
  "#b19562",
  "#879d69",
  "#6891b9",
  "#aa7f62",
  "#8794d0",
  "#bd745f",
  "#6fae76",
  "#b481ad",
  "#7da4a1",
  "#c0a76b",
];

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function compactAxisValue(value: number) {
  if (Math.abs(value) >= 1_000_000)
    return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (Math.abs(value) >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return String(value);
}

function commodityCategory(value: string): {
  label: string;
  icon: LucideIcon;
} {
  const commodity = value.toLowerCase();
  if (/oxygen|water|chemical/.test(commodity))
    return { label: "Chemicals", icon: Beaker };
  if (/food|fruit|vegetable/.test(commodity))
    return { label: "Foods", icon: Utensils };
  if (/generator|purifier|machinery/.test(commodity))
    return { label: "Machinery", icon: Forklift };
  if (/aluminium|copper|steel|titanium|metal/.test(commodity))
    return { label: "Metals", icon: Atom };
  if (/computer|diagnostic|technology/.test(commodity))
    return { label: "Technology", icon: Cpu };
  if (/weapon/.test(commodity)) return { label: "Weapons", icon: Shield };
  if (/composite|membrane|polymer|semiconductor|superconductor/.test(commodity))
    return { label: "Industrial materials", icon: Package };
  return { label: "Commodity", icon: Boxes };
}

const commodityTooltipIconPaths: Record<string, string> = {
  Chemicals:
    '<path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>',
  Foods:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  Machinery:
    '<path d="M12 12H5a2 2 0 0 0-2 2v5"/><path d="M15 19h7"/><path d="M16 19V2"/><path d="M6 12V7a2 2 0 0 1 2-2h2.172a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 16 10.828"/><circle cx="13" cy="19" r="2"/><circle cx="5" cy="19" r="2"/>',
  Metals:
    '<circle cx="12" cy="12" r="1"/><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"/><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"/>',
  Technology:
    '<path d="M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  Weapons:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  "Industrial materials":
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  Commodity:
    '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/>',
};

function commodityTooltipIcon(name: string) {
  const category = commodityCategory(name);
  return `<svg class="commodity-tooltip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${commodityTooltipIconPaths[category.label] ?? commodityTooltipIconPaths.Commodity}</svg>`;
}

function CommodityName({
  name,
  colour,
  showColourChip = true,
}: {
  name: string;
  colour: string;
  showColourChip?: boolean;
}) {
  const category = commodityCategory(name);
  const Icon = category.icon;
  return (
    <span className="commodity-name" title={category.label}>
      {showColourChip && (
        <i style={{ backgroundColor: colour }} aria-hidden="true" />
      )}
      <Icon size={15} aria-hidden="true" />
      <span>{name}</span>
    </span>
  );
}

function diffClass(diff: number) {
  return diff > 0 ? "diff-positive" : "diff-zero";
}

function constructionIsComplete(construction: ColonisationConstruction) {
  return (
    construction.diff <= 0 ||
    /^(complete|completed|closed|done|finished)$/i.test(
      construction.status.trim(),
    )
  );
}

function ConstructionCompletionIndicator({ complete }: { complete: boolean }) {
  const label = complete ? "Construction completed" : "Construction incomplete";
  const Icon = complete ? CircleCheckBig : CircleDashed;
  return (
    <span
      className={`construction-status-indicator ${complete ? "is-complete" : "is-incomplete"}`}
      aria-label={label}
      role="img"
      title={label}
    >
      <Icon size={15} aria-hidden="true" />
    </span>
  );
}

export function colonisationCommanderGroupKey(
  constructionId: string,
  cmdr: string,
) {
  return `${constructionId}\u0000${cmdr}`;
}

export function colonisationCommodityGroupKey(
  constructionId: string,
  commodityKey: string,
) {
  return `${constructionId}\u0000${commodityKey}`;
}

export function colonisationCommodityConstructionGroupKey(
  commodityKey: string,
) {
  return `commodity-constructions\u0000${commodityKey}`;
}

export function colonisationContributionCommanderGroupKey(groupId: string) {
  return `contribution\u0000${groupId}`;
}

export function colonisationContributionConstructionGroupKey(
  groupId: string,
  constructionId: string,
) {
  return `contribution\u0000${groupId}\u0000${constructionId}`;
}

function progressPercentage(delivered: number, need: number) {
  if (need <= 0) return delivered > 0 ? 100 : 0;
  return Math.min(100, Math.round((delivered / need) * 100));
}

function progressLabelSeries(
  constructions: ColonisationConstruction[],
  delivered: (construction: ColonisationConstruction) => number,
) {
  return {
    name: "Progress",
    type: "bar",
    barGap: "-100%",
    barMaxWidth: 42,
    silent: true,
    z: 10,
    tooltip: { show: false },
    itemStyle: { color: "transparent" },
    label: {
      show: true,
      position: "right",
      distance: 10,
      color: "#f2f4f7",
      fontSize: 11,
      fontWeight: 700,
      formatter: (params: unknown) => {
        const item = params as { dataIndex?: number };
        const construction = constructions[item.dataIndex ?? 0];
        if (!construction) return "";
        return `${progressPercentage(delivered(construction), construction.need)}%`;
      },
    },
    data: constructions.map((construction) => construction.need),
  };
}

function NumberCell({ children }: { children: ReactNode }) {
  return <td className="colonisation-number">{children}</td>;
}

interface TotalsProps {
  groups: { need?: number; delivered: number; diff?: number }[];
  showNeedDiff?: boolean;
  labelColSpan?: number;
}

function ColonisationTotalsRow({
  groups,
  showNeedDiff = false,
  labelColSpan = 1,
}: TotalsProps) {
  const totals = colonisationTotals(groups);
  return (
    <tbody className="colonisation-totals">
      <tr>
        <th scope="row" colSpan={labelColSpan}>
          Total · {groups.length} {groups.length === 1 ? "group" : "groups"}
        </th>
        {showNeedDiff && <NumberCell>{formatValue(totals.need)}</NumberCell>}
        <NumberCell>{formatValue(totals.delivered)}</NumberCell>
        {showNeedDiff && <NumberCell>{formatValue(totals.diff)}</NumberCell>}
      </tr>
    </tbody>
  );
}

function ColonisationMobileTotals({
  groups,
  showNeedDiff = false,
}: TotalsProps) {
  const totals = colonisationTotals(groups);
  return (
    <article className="colonisation-totals">
      <header>
        <strong>
          Total · {groups.length} {groups.length === 1 ? "group" : "groups"}
        </strong>
        <dl className={showNeedDiff ? undefined : "single-value"}>
          {showNeedDiff && (
            <div>
              <dt>Need</dt>
              <dd>{formatValue(totals.need)}</dd>
            </div>
          )}
          <div>
            <dt>Delivered</dt>
            <dd>{formatValue(totals.delivered)}</dd>
          </div>
          {showNeedDiff && (
            <div>
              <dt>Diff</dt>
              <dd>{formatValue(totals.diff)}</dd>
            </div>
          )}
        </dl>
      </header>
    </article>
  );
}

export type SortDirection = "asc" | "desc";
export type ColonisationSortKey =
  | "construction"
  | "system"
  | "cmdr"
  | "commodity"
  | "status"
  | "date"
  | "need"
  | "delivered"
  | "diff";
export interface ColonisationSort {
  key: ColonisationSortKey;
  direction: SortDirection;
}

function compareSortValues(
  left: string | number,
  right: string | number,
  direction: SortDirection,
) {
  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: "base",
        });
  return direction === "asc" ? result : -result;
}

function sortedBy<T>(
  items: T[],
  value: (item: T) => string | number,
  direction: SortDirection,
) {
  return [...items].sort((left, right) =>
    compareSortValues(value(left), value(right), direction),
  );
}

function SortHeader<Key extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: Key;
  activeKey: Key;
  direction: SortDirection;
  onSort: (key: Key) => void;
}) {
  const active = sortKey === activeKey;
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <th
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        className="colonisation-sort-button"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

function CopyableValue({ value, label }: { value: string; label: string }) {
  if (!value) return null;
  return (
    <span className="colonisation-copyable-value">
      <span>{value}</span>
      <CopyTextButton value={value} label={label} />
    </span>
  );
}

function ConstructionCopyActions({
  construction,
  system,
}: {
  construction: string;
  system: string;
}) {
  return (
    <span className="colonisation-copy-actions">
      <CopyTextButton value={construction} label="Copy construction name" />
      {system && <CopyTextButton value={system} label="Copy system name" />}
    </span>
  );
}

export function ColonisationProgressChart({
  constructions,
}: {
  constructions: ColonisationConstruction[];
}) {
  const commodityNames = colonisationCommodityNames(constructions);
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const option = {
    animationDuration: 350,
    aria: { enabled: true },
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    tooltip: {
      trigger: "item",
      backgroundColor: "#121821",
      borderColor: "#303946",
      padding: 13,
      confine: true,
      extraCssText: "max-height:70vh;overflow-y:auto;",
      textStyle: { color: "#f2f4f7", fontSize: 11 },
      formatter: (params: unknown) => {
        const item = params as { dataIndex?: number; seriesName?: string };
        const construction = constructions[item.dataIndex ?? 0];
        if (!construction) return "";
        if (item.seriesName === "Remaining") {
          const missing = construction.commodities.filter(
            (commodity) => commodity.diff > 0,
          );
          const lines = missing.map(
            (commodity) =>
              `<div class="colonisation-tooltip-row"><span>${commodityTooltipIcon(commodity.commodity)}${escapeHtml(commodity.commodity)}</span><b>${escapeHtml(formatValue(commodity.diff))}</b><small>missing</small></div>`,
          );
          return `<div class="colonisation-tooltip"><strong>${escapeHtml(construction.construction)}</strong><span>Missing commodities</span>${lines.join("")}<footer>${escapeHtml(formatValue(construction.diff))} tonnes remaining</footer></div>`;
        }
        const commodity = construction.commodities.find(
          (candidate) => candidate.commodity === item.seriesName,
        );
        if (!commodity) return "";
        const line = `<div class="colonisation-tooltip-row"><span>${commodityTooltipIcon(commodity.commodity)}${escapeHtml(commodity.commodity)}</span><b>Delivered ${escapeHtml(formatValue(commodity.delivered))}</b><small>Required ${escapeHtml(formatValue(commodity.need))} · Diff ${escapeHtml(formatValue(commodity.diff))}</small></div>`;
        return `<div class="colonisation-tooltip"><strong>${escapeHtml(construction.construction)}</strong><span>Commodity progress</span>${line}</div>`;
      },
    },
    legend: { show: false },
    grid: { left: 155, right: 72, top: 22, bottom: 42 },
    xAxis: {
      type: "value",
      name: "TONNES",
      nameTextStyle: { color: "#657181", fontSize: 9 },
      splitNumber: 5,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        hideOverlap: true,
        formatter: compactAxisValue,
      },
      splitLine: { lineStyle: { color: "#222a34" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: constructions.map((construction) => construction.construction),
      axisLabel: {
        color: "#bcc5d0",
        fontSize: 10,
        width: 135,
        overflow: "truncate",
      },
      axisLine: { lineStyle: { color: "#2a323d" } },
      axisTick: { show: false },
    },
    series: [
      ...commodityNames.map((commodity) => ({
        name: commodity,
        type: "bar",
        stack: "construction",
        barMaxWidth: 42,
        itemStyle: { color: colours.get(commodity), borderRadius: 1 },
        emphasis: { focus: "series" },
        data: constructions.map((construction) => {
          const item = construction.commodities.find(
            (candidate) => candidate.commodity === commodity,
          );
          return item ? Math.min(item.need, item.delivered) : 0;
        }),
      })),
      {
        name: "Remaining",
        type: "bar",
        stack: "construction",
        barMaxWidth: 42,
        itemStyle: { color: "#27313d", borderColor: "#3a4655", borderWidth: 1 },
        emphasis: { disabled: true },
        data: constructions.map((construction) => {
          const filled = construction.commodities.reduce(
            (total, commodity) =>
              total + Math.min(commodity.need, commodity.delivered),
            0,
          );
          return Math.max(0, construction.need - filled);
        }),
      },
      progressLabelSeries(constructions, (construction) =>
        construction.commodities.reduce(
          (total, commodity) =>
            total + Math.min(commodity.need, commodity.delivered),
          0,
        ),
      ),
    ],
    media: [
      {
        query: { maxWidth: 520 },
        option: {
          grid: { left: 103, right: 52, top: 18, bottom: 38 },
          xAxis: {
            splitNumber: 3,
            nameTextStyle: { fontSize: 7 },
            axisLabel: {
              color: "#778291",
              fontSize: 8,
              hideOverlap: true,
              formatter: compactAxisValue,
            },
          },
          yAxis: {
            axisLabel: {
              color: "#bcc5d0",
              fontSize: 8,
              width: 88,
              overflow: "truncate",
            },
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{
        height: Math.min(680, Math.max(270, constructions.length * 64 + 110)),
        width: "100%",
      }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
    />
  );
}

export function ColonisationCommanderProgressChart({
  constructions,
}: {
  constructions: ColonisationConstruction[];
}) {
  const constructionGroups = new Map(
    constructions.map((construction) => [
      construction.id,
      colonisationCommanderGroups(construction),
    ]),
  );
  const commanderNames = [
    ...new Set(
      [...constructionGroups.values()].flatMap((groups) =>
        groups.map((group) => group.cmdr),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const colours = new Map(
    commanderNames.map((cmdr, index) => [
      cmdr,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const deliveredFor = (construction: ColonisationConstruction) =>
    (constructionGroups.get(construction.id) ?? []).reduce(
      (total, group) => total + group.delivered,
      0,
    );

  const option = {
    animationDuration: 350,
    aria: { enabled: true },
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    tooltip: {
      trigger: "item",
      backgroundColor: "#121821",
      borderColor: "#303946",
      padding: 13,
      confine: true,
      extraCssText: "max-height:70vh;overflow-y:auto;",
      textStyle: { color: "#f2f4f7", fontSize: 11 },
      formatter: (params: unknown) => {
        const item = params as { dataIndex?: number; seriesName?: string };
        const construction = constructions[item.dataIndex ?? 0];
        if (!construction) return "";
        if (item.seriesName === "Remaining") {
          return `<div class="colonisation-tooltip"><strong>${escapeHtml(construction.construction)}</strong><span>Construction progress</span><footer>${escapeHtml(formatValue(construction.diff))} tonnes remaining</footer></div>`;
        }
        const group = (constructionGroups.get(construction.id) ?? []).find(
          (candidate) => candidate.cmdr === item.seriesName,
        );
        if (!group) return "";
        const lines = group.commodities.map(
          (row) =>
            `<div class="colonisation-tooltip-row"><span>${commodityTooltipIcon(row.commodity.commodity)}${escapeHtml(row.commodity.commodity)}</span><b>${escapeHtml(formatValue(row.delivered))}</b><small>delivered</small></div>`,
        );
        return `<div class="colonisation-tooltip"><strong>Cmdr ${escapeHtml(group.cmdr)}</strong><span>${escapeHtml(construction.construction)} · delivered by commodity</span>${lines.join("")}<footer>${escapeHtml(formatValue(group.delivered))} tonnes delivered</footer></div>`;
      },
    },
    legend: { show: false },
    grid: { left: 155, right: 72, top: 22, bottom: 42 },
    xAxis: {
      type: "value",
      name: "TONNES",
      nameTextStyle: { color: "#657181", fontSize: 9 },
      splitNumber: 5,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        hideOverlap: true,
        formatter: compactAxisValue,
      },
      splitLine: { lineStyle: { color: "#222a34" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: constructions.map((construction) => construction.construction),
      axisLabel: {
        color: "#bcc5d0",
        fontSize: 10,
        width: 135,
        overflow: "truncate",
      },
      axisLine: { lineStyle: { color: "#2a323d" } },
      axisTick: { show: false },
    },
    series: [
      ...commanderNames.map((cmdr) => ({
        name: cmdr,
        type: "bar",
        stack: "construction",
        barMaxWidth: 42,
        itemStyle: { color: colours.get(cmdr), borderRadius: 1 },
        emphasis: { focus: "series" },
        data: constructions.map((construction) => {
          const groups = constructionGroups.get(construction.id) ?? [];
          const group = groups.find((candidate) => candidate.cmdr === cmdr);
          const delivered = groups.reduce(
            (total, candidate) => total + candidate.delivered,
            0,
          );
          const scale =
            construction.need > 0 && delivered > construction.need
              ? construction.need / delivered
              : 1;
          return (group?.delivered ?? 0) * scale;
        }),
      })),
      {
        name: "Remaining",
        type: "bar",
        stack: "construction",
        barMaxWidth: 42,
        itemStyle: { color: "#27313d", borderColor: "#3a4655", borderWidth: 1 },
        emphasis: { disabled: true },
        data: constructions.map((construction) =>
          Math.max(0, construction.need - deliveredFor(construction)),
        ),
      },
      progressLabelSeries(constructions, deliveredFor),
    ],
    media: [
      {
        query: { maxWidth: 520 },
        option: {
          grid: { left: 103, right: 52, top: 18, bottom: 38 },
          xAxis: {
            splitNumber: 3,
            nameTextStyle: { fontSize: 7 },
            axisLabel: {
              color: "#778291",
              fontSize: 8,
              hideOverlap: true,
              formatter: compactAxisValue,
            },
          },
          yAxis: {
            axisLabel: {
              color: "#bcc5d0",
              fontSize: 8,
              width: 88,
              overflow: "truncate",
            },
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{
        height: Math.min(680, Math.max(270, constructions.length * 64 + 110)),
        width: "100%",
      }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
    />
  );
}

export function ColonisationContributionsChart({
  groups,
}: {
  groups: ColonisationContributionGroup[];
}) {
  const commodityNames = contributionCommodityNames(groups);
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );

  const option = {
    animationDuration: 350,
    aria: { enabled: true },
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    tooltip: {
      trigger: "item",
      backgroundColor: "#121821",
      borderColor: "#303946",
      padding: 13,
      confine: true,
      extraCssText: "max-height:70vh;overflow-y:auto;",
      textStyle: { color: "#f2f4f7", fontSize: 11 },
      formatter: (params: unknown) => {
        const item = params as { dataIndex?: number; seriesName?: string };
        const group = groups[item.dataIndex ?? 0];
        if (!group) return "";
        const commodity = group.commodities.find(
          (candidate) => candidate.commodity === item.seriesName,
        );
        if (!commodity) return "";
        const line = `<div class="colonisation-tooltip-row contribution"><span>${commodityTooltipIcon(commodity.commodity)}${escapeHtml(commodity.commodity)}</span><b>${escapeHtml(formatValue(commodity.delivered))}</b></div>`;
        return `<div class="colonisation-tooltip"><strong>Cmdr ${escapeHtml(group.cmdr)}</strong><span>Delivered commodity</span>${line}</div>`;
      },
    },
    legend: { show: false },
    grid: { left: 155, right: 28, top: 22, bottom: 42 },
    xAxis: {
      type: "value",
      name: "TONNES",
      nameTextStyle: { color: "#657181", fontSize: 9 },
      splitNumber: 5,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        hideOverlap: true,
        formatter: compactAxisValue,
      },
      splitLine: { lineStyle: { color: "#222a34" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: groups.map((group) => `Cmdr ${group.cmdr}`),
      axisLabel: {
        color: "#bcc5d0",
        fontSize: 10,
        width: 135,
        overflow: "truncate",
      },
      axisLine: { lineStyle: { color: "#2a323d" } },
      axisTick: { show: false },
    },
    series: commodityNames.map((commodity) => ({
      name: commodity,
      type: "bar",
      stack: "contributions",
      barMaxWidth: 42,
      itemStyle: { color: colours.get(commodity), borderRadius: 1 },
      emphasis: { focus: "series" },
      data: groups.map(
        (group) =>
          group.commodities.find(
            (candidate) => candidate.commodity === commodity,
          )?.delivered ?? 0,
      ),
    })),
    media: [
      {
        query: { maxWidth: 520 },
        option: {
          grid: { left: 103, right: 12, top: 18, bottom: 38 },
          xAxis: {
            splitNumber: 3,
            nameTextStyle: { fontSize: 7 },
            axisLabel: {
              color: "#778291",
              fontSize: 8,
              hideOverlap: true,
              formatter: compactAxisValue,
            },
          },
          yAxis: {
            axisLabel: {
              color: "#bcc5d0",
              fontSize: 8,
              width: 88,
              overflow: "truncate",
            },
          },
        },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{
        height: Math.min(680, Math.max(270, groups.length * 64 + 110)),
        width: "100%",
      }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
    />
  );
}

function ContributionCommodity({
  commodity,
  colour,
}: {
  commodity: ColonisationContributionCommodity;
  colour: string;
}) {
  return (
    <>
      <th scope="row">
        <CommodityName name={commodity.commodity} colour={colour} />
      </th>
      <NumberCell>{formatValue(commodity.delivered)}</NumberCell>
    </>
  );
}

export function ColonisationContributionsTable({
  groups,
  sort,
  onSort,
  collapsedCommanderIds,
  collapsedConstructionIds,
  onToggleCommander,
  onToggleConstruction,
}: {
  groups: ColonisationContributionGroup[];
  sort: ColonisationSort;
  onSort: (key: ColonisationSortKey) => void;
  collapsedCommanderIds: ReadonlySet<string>;
  collapsedConstructionIds: ReadonlySet<string>;
  onToggleCommander: (groupId: string) => void;
  onToggleConstruction: (groupId: string, constructionId: string) => void;
}) {
  const commodityNames = contributionCommodityNames(groups);
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const sortedGroups = useMemo(
    () =>
      sortedBy(
        groups,
        (group) => (sort.key === "delivered" ? group.delivered : group.cmdr),
        ["cmdr", "delivered"].includes(sort.key) ? sort.direction : "asc",
      ),
    [groups, sort],
  );
  const sortConstructions = (group: ColonisationContributionGroup) =>
    sortedBy(
      group.constructions,
      (construction) =>
        sort.key === "system"
          ? construction.system
          : sort.key === "status"
            ? colonisationConstructionStatus(construction.status)
            : sort.key === "delivered"
              ? construction.delivered
              : construction.construction,
      ["construction", "system", "status", "delivered"].includes(sort.key)
        ? sort.direction
        : "asc",
    );
  const sortCommodities = (commodities: ColonisationContributionCommodity[]) =>
    sortedBy(
      commodities,
      (commodity) =>
        sort.key === "delivered" ? commodity.delivered : commodity.commodity,
      ["commodity", "delivered"].includes(sort.key) ? sort.direction : "asc",
    );

  return (
    <>
      <div className="desktop-table colonisation-grouped-table contribution-grouped-table">
        <table>
          <thead>
            <tr>
              <SortHeader
                label="Cmdr / Construction / Commodity"
                sortKey="cmdr"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={onSort}
              />
              <SortHeader
                label="Delivered"
                sortKey="delivered"
                activeKey={sort.key}
                direction={sort.direction}
                onSort={onSort}
              />
            </tr>
          </thead>
          <ColonisationTotalsRow groups={groups} />
          {sortedGroups.map((group) => {
            const commanderCollapsed = collapsedCommanderIds.has(
              colonisationContributionCommanderGroupKey(group.id),
            );
            return (
              <tbody key={group.id}>
                <tr className="contribution-cmdr-group-row">
                  <th scope="rowgroup">
                    <span className="contribution-cmdr-identity">
                      <button
                        type="button"
                        className="contribution-construction-toggle"
                        aria-expanded={!commanderCollapsed}
                        aria-label={`${commanderCollapsed ? "Expand" : "Collapse"} Cmdr ${group.cmdr}`}
                        onClick={() => onToggleCommander(group.id)}
                      >
                        {commanderCollapsed ? (
                          <ChevronRight size={14} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={14} aria-hidden="true" />
                        )}
                      </button>
                      <span className="colonisation-group-label">
                        <span>Cmdr {group.cmdr}</span>
                        <small>
                          {group.constructions.length} constructions ·{" "}
                          {group.events} events
                        </small>
                      </span>
                    </span>
                  </th>
                  <NumberCell>{formatValue(group.delivered)}</NumberCell>
                </tr>
                {!commanderCollapsed &&
                  sortConstructions(group).map((construction) => {
                    const constructionCollapsed = collapsedConstructionIds.has(
                      colonisationContributionConstructionGroupKey(
                        group.id,
                        construction.id,
                      ),
                    );
                    return (
                      <Fragment key={`${group.id}-${construction.id}`}>
                        <tr className="contribution-construction-group-row">
                          <th scope="rowgroup">
                            <span className="contribution-construction-identity">
                              <button
                                type="button"
                                className="contribution-construction-toggle"
                                aria-expanded={!constructionCollapsed}
                                aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                                onClick={() =>
                                  onToggleConstruction(
                                    group.id,
                                    construction.id,
                                  )
                                }
                              >
                                {constructionCollapsed ? (
                                  <ChevronRight size={14} aria-hidden="true" />
                                ) : (
                                  <ChevronDown size={14} aria-hidden="true" />
                                )}
                              </button>
                              <span className="colonisation-group-label">
                                <CopyableValue
                                  value={construction.construction}
                                  label="Copy construction name"
                                />
                                <small>
                                  <CopyableValue
                                    value={construction.system}
                                    label="Copy system name"
                                  />
                                  <span>{construction.events} events</span>
                                </small>
                              </span>
                            </span>
                          </th>
                          <NumberCell>
                            {formatValue(construction.delivered)}
                          </NumberCell>
                        </tr>
                        {!constructionCollapsed &&
                          sortCommodities(construction.commodities).map(
                            (commodity) => (
                              <tr
                                className="commodity-row"
                                key={`${group.id}-${construction.id}-${commodity.key}`}
                              >
                                <ContributionCommodity
                                  commodity={commodity}
                                  colour={
                                    colours.get(commodity.commodity) ??
                                    commodityColours[0]
                                  }
                                />
                              </tr>
                            ),
                          )}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="colonisation-mobile-groups contribution-mobile-groups">
        <ColonisationMobileTotals groups={groups} />
        {sortedGroups.map((group) => {
          const commanderCollapsed = collapsedCommanderIds.has(
            colonisationContributionCommanderGroupKey(group.id),
          );
          return (
            <article key={group.id}>
              <header>
                <button
                  type="button"
                  className="mobile-construction-toggle"
                  aria-expanded={!commanderCollapsed}
                  aria-label={`${commanderCollapsed ? "Expand" : "Collapse"} Cmdr ${group.cmdr}`}
                  onClick={() => onToggleCommander(group.id)}
                >
                  {commanderCollapsed ? (
                    <ChevronRight size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                  <div>
                    <strong>Cmdr {group.cmdr}</strong>
                    <span>
                      {group.constructions.length} constructions ·{" "}
                      {group.events} events
                    </span>
                  </div>
                </button>
                <dl className="single-value">
                  <div>
                    <dt>Delivered</dt>
                    <dd>{formatValue(group.delivered)}</dd>
                  </div>
                </dl>
              </header>
              {!commanderCollapsed &&
                sortConstructions(group).map((construction) => {
                  const constructionCollapsed = collapsedConstructionIds.has(
                    colonisationContributionConstructionGroupKey(
                      group.id,
                      construction.id,
                    ),
                  );
                  return (
                    <section key={`${group.id}-${construction.id}`}>
                      <div className="mobile-commander-heading">
                        <span className="contribution-construction-identity">
                          <button
                            type="button"
                            className="contribution-construction-toggle"
                            aria-expanded={!constructionCollapsed}
                            aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                            onClick={() =>
                              onToggleConstruction(group.id, construction.id)
                            }
                          >
                            {constructionCollapsed ? (
                              <ChevronRight size={14} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={14} aria-hidden="true" />
                            )}
                          </button>
                          <span className="colonisation-group-label">
                            <strong>
                              <CopyableValue
                                value={construction.construction}
                                label="Copy construction name"
                              />
                            </strong>
                            <CopyableValue
                              value={construction.system}
                              label="Copy system name"
                            />
                          </span>
                        </span>
                        <dl className="single-value">
                          <div>
                            <dt>Delivered</dt>
                            <dd>{formatValue(construction.delivered)}</dd>
                          </div>
                        </dl>
                      </div>
                      {!constructionCollapsed &&
                        sortCommodities(construction.commodities).map(
                          (commodity) => (
                            <div
                              className="mobile-commodity-row"
                              key={`${group.id}-${construction.id}-${commodity.key}`}
                            >
                              <CommodityName
                                name={commodity.commodity}
                                colour={
                                  colours.get(commodity.commodity) ??
                                  commodityColours[0]
                                }
                              />
                              <dl className="single-value">
                                <div>
                                  <dt>Delivered</dt>
                                  <dd>{formatValue(commodity.delivered)}</dd>
                                </div>
                              </dl>
                            </div>
                          ),
                        )}
                    </section>
                  );
                })}
            </article>
          );
        })}
      </div>
    </>
  );
}

function contributionRecordSortValue(
  record: ColonisationContributionRecord,
  key: ColonisationSortKey,
) {
  switch (key) {
    case "construction":
      return record.construction;
    case "system":
      return record.system;
    case "date":
      return record.timestamp;
    case "commodity":
      return record.commodity;
    case "delivered":
      return record.delivered;
    case "status":
      return colonisationConstructionStatus(record.status);
    case "cmdr":
      return record.cmdr;
    default:
      return record.timestamp;
  }
}

function contributionGroupSortValue(
  records: ColonisationContributionRecord[],
  delivered: number,
  key: ColonisationSortKey,
) {
  if (key === "delivered") return delivered;
  const sorted = [...records].sort((left, right) =>
    compareSortValues(
      contributionRecordSortValue(left, key),
      contributionRecordSortValue(right, key),
      "asc",
    ),
  );
  return sorted[0] ? contributionRecordSortValue(sorted[0], key) : "";
}

function contributionDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ColonisationContributionRecordsTable({
  groups,
  sort,
  onSort,
  collapsedConstructionIds,
  collapsedCommanderIds,
  onToggleConstruction,
  onToggleCommander,
}: {
  groups: ColonisationRecordConstructionGroup[];
  sort: ColonisationSort;
  onSort: (key: ColonisationSortKey) => void;
  collapsedConstructionIds: ReadonlySet<string>;
  collapsedCommanderIds: ReadonlySet<string>;
  onToggleConstruction: (constructionId: string) => void;
  onToggleCommander: (constructionId: string, cmdr: string) => void;
}) {
  const commodityNames = [
    ...new Set(
      groups.flatMap((construction) =>
        construction.records.map((record) => record.commodity),
      ),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const sortedGroups = useMemo(
    () =>
      sortedBy(
        groups,
        (group) =>
          sort.key === "construction"
            ? group.construction
            : sort.key === "system"
              ? group.system
              : sort.key === "status"
                ? colonisationConstructionStatus(group.status)
                : contributionGroupSortValue(
                    group.records,
                    group.delivered,
                    sort.key,
                  ),
        sort.key === "cmdr" ? "asc" : sort.direction,
      ),
    [groups, sort],
  );
  const sortedCommanders = (commanders: ColonisationRecordCommanderGroup[]) =>
    sortedBy(
      commanders,
      (commander) =>
        sort.key === "cmdr"
          ? commander.cmdr
          : ["date", "commodity", "delivered"].includes(sort.key)
            ? contributionGroupSortValue(
                commander.records,
                commander.delivered,
                sort.key,
              )
            : commander.cmdr,
      ["cmdr", "date", "commodity", "delivered"].includes(sort.key)
        ? sort.direction
        : "asc",
    );
  const sortedRecords = (records: ColonisationContributionRecord[]) =>
    sortedBy(
      records,
      (record) => contributionRecordSortValue(record, sort.key),
      ["date", "commodity", "delivered"].includes(sort.key)
        ? sort.direction
        : "asc",
    );

  return (
    <>
      <div className="desktop-table colonisation-grouped-table contribution-records-table">
        <table>
          <thead>
            <tr>
              {(
                [
                  ["construction", "Construction / Cmdr / Contribution"],
                  ["system", "System"],
                  ["date", "Date"],
                  ["commodity", "Commodity"],
                  ["delivered", "Delivered"],
                ] as const
              ).map(([key, label]) => (
                <SortHeader
                  key={key}
                  label={label}
                  sortKey={key}
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <ColonisationTotalsRow groups={groups} labelColSpan={4} />
          {sortedGroups.map((construction) => {
            const constructionCollapsed = collapsedConstructionIds.has(
              construction.id,
            );
            const constructionComplete =
              /^(complete|completed|closed|done|finished)$/i.test(
                construction.status.trim(),
              );
            return (
              <tbody key={construction.id}>
                <tr
                  className={`construction-group-row ${diffClass(
                    constructionComplete ? 0 : 1,
                  )}`}
                >
                  <th scope="rowgroup">
                    <span className="contribution-construction-identity">
                      <button
                        type="button"
                        className="contribution-construction-toggle"
                        aria-expanded={!constructionCollapsed}
                        aria-label={`${
                          constructionCollapsed ? "Expand" : "Collapse"
                        } construction ${construction.construction}`}
                        onClick={() => onToggleConstruction(construction.id)}
                      >
                        {constructionCollapsed ? (
                          <ChevronRight size={14} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={14} aria-hidden="true" />
                        )}
                      </button>
                      <ConstructionCompletionIndicator
                        complete={constructionComplete}
                      />
                      <span className="colonisation-group-label">
                        <CopyableValue
                          value={construction.construction}
                          label="Copy construction name"
                        />
                        <small>
                          {construction.status} ·{" "}
                          {construction.commanders.length} commanders ·{" "}
                          {construction.records.length} contributions
                        </small>
                      </span>
                    </span>
                  </th>
                  <td>
                    <CopyableValue
                      value={construction.system}
                      label="Copy system name"
                    />
                  </td>
                  <td>
                    {contributionDate(construction.records[0]?.timestamp ?? "")}
                  </td>
                  <td>
                    {
                      new Set(
                        construction.records.map((record) => record.commodity),
                      ).size
                    }{" "}
                    commodities
                  </td>
                  <NumberCell>{formatValue(construction.delivered)}</NumberCell>
                </tr>
                {!constructionCollapsed &&
                  sortedCommanders(construction.commanders).map((commander) => {
                    const commanderCollapsed = collapsedCommanderIds.has(
                      colonisationCommanderGroupKey(
                        construction.id,
                        commander.cmdr,
                      ),
                    );
                    return (
                      <Fragment key={commander.id}>
                        <tr className="commander-group-row">
                          <th scope="rowgroup">
                            <button
                              type="button"
                              className="colonisation-group-toggle commander-group-toggle"
                              aria-expanded={!commanderCollapsed}
                              onClick={() =>
                                onToggleCommander(
                                  construction.id,
                                  commander.cmdr,
                                )
                              }
                            >
                              {commanderCollapsed ? (
                                <ChevronRight size={14} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={14} aria-hidden="true" />
                              )}
                              <span className="colonisation-group-label">
                                <span>Cmdr {commander.cmdr}</span>
                                <small>
                                  {commander.records.length} contributions
                                </small>
                              </span>
                            </button>
                          </th>
                          <td>—</td>
                          <td>
                            {contributionDate(
                              commander.records[0]?.timestamp ?? "",
                            )}
                          </td>
                          <td>
                            {
                              new Set(
                                commander.records.map(
                                  (record) => record.commodity,
                                ),
                              ).size
                            }{" "}
                            commodities
                          </td>
                          <NumberCell>
                            {formatValue(commander.delivered)}
                          </NumberCell>
                        </tr>
                        {!commanderCollapsed &&
                          sortedRecords(commander.records).map((record) => (
                            <tr
                              className="contribution-record-row"
                              key={record.id}
                            >
                              <th scope="row">Contribution {record.eventId}</th>
                              <td>
                                <CopyableValue
                                  value={record.system}
                                  label="Copy system name"
                                />
                              </td>
                              <td>{contributionDate(record.timestamp)}</td>
                              <td>
                                <CommodityName
                                  name={record.commodity}
                                  showColourChip={false}
                                  colour={
                                    colours.get(record.commodity) ??
                                    commodityColours[0]
                                  }
                                />
                              </td>
                              <NumberCell>
                                {formatValue(record.delivered)}
                              </NumberCell>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="colonisation-mobile-groups contribution-record-mobile-groups">
        <ColonisationMobileTotals groups={groups} />
        {sortedGroups.map((construction) => {
          const constructionCollapsed = collapsedConstructionIds.has(
            construction.id,
          );
          const constructionComplete =
            /^(complete|completed|closed|done|finished)$/i.test(
              construction.status.trim(),
            );
          return (
            <article key={construction.id}>
              <header className={diffClass(constructionComplete ? 0 : 1)}>
                <span className="contribution-mobile-construction-identity">
                  <button
                    type="button"
                    className="contribution-construction-toggle"
                    aria-expanded={!constructionCollapsed}
                    aria-label={`${
                      constructionCollapsed ? "Expand" : "Collapse"
                    } construction ${construction.construction}`}
                    onClick={() => onToggleConstruction(construction.id)}
                  >
                    {constructionCollapsed ? (
                      <ChevronRight size={14} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={14} aria-hidden="true" />
                    )}
                  </button>
                  <ConstructionCompletionIndicator
                    complete={constructionComplete}
                  />
                  <span className="contribution-mobile-construction-details">
                    <strong>
                      <CopyableValue
                        value={construction.construction}
                        label="Copy construction name"
                      />
                    </strong>
                    <span>
                      <CopyableValue
                        value={construction.system}
                        label="Copy system name"
                      />
                      <span>· {construction.status}</span>
                    </span>
                  </span>
                </span>
              </header>
              {!constructionCollapsed &&
                sortedCommanders(construction.commanders).map((commander) => {
                  const commanderCollapsed = collapsedCommanderIds.has(
                    colonisationCommanderGroupKey(
                      construction.id,
                      commander.cmdr,
                    ),
                  );
                  return (
                    <section key={commander.id}>
                      <button
                        type="button"
                        className="mobile-commander-heading mobile-group-toggle"
                        aria-expanded={!commanderCollapsed}
                        onClick={() =>
                          onToggleCommander(construction.id, commander.cmdr)
                        }
                      >
                        <strong>
                          {commanderCollapsed ? (
                            <ChevronRight size={14} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={14} aria-hidden="true" />
                          )}
                          Cmdr {commander.cmdr}
                        </strong>
                        <span>
                          {commander.records.length} contributions ·{" "}
                          {formatValue(commander.delivered)} delivered
                        </span>
                      </button>
                      {!commanderCollapsed &&
                        sortedRecords(commander.records).map((record) => (
                          <div
                            className="mobile-contribution-record"
                            key={record.id}
                          >
                            <div>
                              <CommodityName
                                name={record.commodity}
                                showColourChip={false}
                                colour={
                                  colours.get(record.commodity) ??
                                  commodityColours[0]
                                }
                              />
                              <span>{contributionDate(record.timestamp)}</span>
                              <CopyableValue
                                value={record.system}
                                label="Copy system name"
                              />
                            </div>
                            <strong>{formatValue(record.delivered)}</strong>
                          </div>
                        ))}
                    </section>
                  );
                })}
            </article>
          );
        })}
      </div>
    </>
  );
}

export function ColonisationGroupedTable({
  constructions,
  sort,
  onSort,
  collapsedConstructionIds,
  collapsedCommanderIds,
  onToggleConstruction,
  onToggleCommander,
}: {
  constructions: ColonisationConstruction[];
  sort: ColonisationSort;
  onSort: (key: ColonisationSortKey) => void;
  collapsedConstructionIds: ReadonlySet<string>;
  collapsedCommanderIds: ReadonlySet<string>;
  onToggleConstruction: (constructionId: string) => void;
  onToggleCommander: (constructionId: string, cmdr: string) => void;
}) {
  const commodityNames = colonisationCommodityNames(constructions);
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const sortedConstructions = useMemo(
    () =>
      sortedBy(
        constructions,
        (construction) =>
          sort.key === "system"
            ? construction.system
            : sort.key === "status"
              ? colonisationConstructionStatus(construction.status)
              : ["need", "delivered", "diff"].includes(sort.key)
                ? construction[sort.key as "need" | "delivered" | "diff"]
                : construction.construction,
        [
          "construction",
          "system",
          "status",
          "need",
          "delivered",
          "diff",
        ].includes(sort.key)
          ? sort.direction
          : "asc",
      ),
    [constructions, sort],
  );
  const sortedCommanderGroups = (construction: ColonisationConstruction) =>
    sortedBy(
      colonisationCommanderGroups(construction),
      (group) =>
        ["need", "delivered", "diff"].includes(sort.key)
          ? group[sort.key as "need" | "delivered" | "diff"]
          : group.cmdr,
      ["cmdr", "need", "delivered", "diff"].includes(sort.key)
        ? sort.direction
        : "asc",
    );
  const sortedCommodityRows = (
    rows: ReturnType<typeof colonisationCommanderGroups>[number]["commodities"],
  ) =>
    sortedBy(
      rows,
      (row) =>
        sort.key === "need"
          ? row.commodity.need
          : sort.key === "delivered"
            ? row.delivered
            : sort.key === "diff"
              ? row.diff
              : row.commodity.commodity,
      ["commodity", "need", "delivered", "diff"].includes(sort.key)
        ? sort.direction
        : "asc",
    );

  return (
    <>
      <div className="desktop-table colonisation-grouped-table">
        <table>
          <thead>
            <tr>
              {(
                [
                  ["construction", "Construction / Cmdr / Commodity"],
                  ["need", "Need"],
                  ["delivered", "Delivered"],
                  ["diff", "Diff"],
                ] as const
              ).map(([key, label]) => (
                <SortHeader
                  key={key}
                  label={label}
                  sortKey={key}
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <ColonisationTotalsRow groups={constructions} showNeedDiff />
          {sortedConstructions.map((construction) => {
            const groups = sortedCommanderGroups(construction);
            const constructionCollapsed = collapsedConstructionIds.has(
              construction.id,
            );
            const constructionComplete = constructionIsComplete(construction);
            return (
              <tbody key={construction.id}>
                <tr
                  className={`construction-group-row ${diffClass(construction.diff)}`}
                >
                  <th scope="rowgroup">
                    <span className="colonisation-group-cell">
                      <button
                        type="button"
                        className="colonisation-group-toggle construction-group-toggle"
                        aria-expanded={!constructionCollapsed}
                        aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                        onClick={() => onToggleConstruction(construction.id)}
                      >
                        {constructionCollapsed ? (
                          <ChevronRight size={14} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={14} aria-hidden="true" />
                        )}
                        <ConstructionCompletionIndicator
                          complete={constructionComplete}
                        />
                        <span className="colonisation-group-label">
                          <span>{construction.construction}</span>
                          <small>
                            {[construction.system, construction.status]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </button>
                      <ConstructionCopyActions
                        construction={construction.construction}
                        system={construction.system}
                      />
                    </span>
                  </th>
                  <NumberCell>{formatValue(construction.need)}</NumberCell>
                  <NumberCell>{formatValue(construction.delivered)}</NumberCell>
                  <NumberCell>{formatValue(construction.diff)}</NumberCell>
                </tr>
                {!constructionCollapsed &&
                  groups.map((group) => {
                    const commanderCollapsed = collapsedCommanderIds.has(
                      colonisationCommanderGroupKey(
                        construction.id,
                        group.cmdr,
                      ),
                    );
                    return (
                      <Fragment key={`${construction.id}-${group.cmdr}`}>
                        <tr className="commander-group-row">
                          <th scope="rowgroup">
                            <button
                              type="button"
                              className="colonisation-group-toggle commander-group-toggle"
                              aria-expanded={!commanderCollapsed}
                              aria-label={`${commanderCollapsed ? "Expand" : "Collapse"} Cmdr ${group.cmdr}`}
                              onClick={() =>
                                onToggleCommander(construction.id, group.cmdr)
                              }
                            >
                              {commanderCollapsed ? (
                                <ChevronRight size={14} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={14} aria-hidden="true" />
                              )}
                              <span className="colonisation-group-label">
                                <span>Cmdr {group.cmdr}</span>
                                <small>
                                  {group.commodities.length} commodities · group
                                  totals
                                </small>
                              </span>
                            </button>
                          </th>
                          <NumberCell>{formatValue(group.need)}</NumberCell>
                          <NumberCell>
                            {formatValue(group.delivered)}
                          </NumberCell>
                          <NumberCell>—</NumberCell>
                        </tr>
                        {!commanderCollapsed &&
                          sortedCommodityRows(group.commodities).map((row) => (
                            <tr
                              className={`commodity-row ${diffClass(row.diff)}`}
                              key={`${construction.id}-${group.cmdr}-${row.commodity.key}`}
                            >
                              <th scope="row">
                                <CommodityName
                                  name={row.commodity.commodity}
                                  colour={
                                    colours.get(row.commodity.commodity) ??
                                    commodityColours[0]
                                  }
                                />
                              </th>
                              <NumberCell>
                                {formatValue(row.commodity.need)}
                              </NumberCell>
                              <NumberCell>
                                {formatValue(row.delivered)}
                              </NumberCell>
                              <NumberCell>—</NumberCell>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="colonisation-mobile-groups">
        <ColonisationMobileTotals groups={constructions} showNeedDiff />
        {sortedConstructions.map((construction) => {
          const constructionCollapsed = collapsedConstructionIds.has(
            construction.id,
          );
          const constructionComplete = constructionIsComplete(construction);
          return (
            <article key={construction.id}>
              <header className={diffClass(construction.diff)}>
                <button
                  type="button"
                  className="mobile-construction-toggle"
                  aria-expanded={!constructionCollapsed}
                  aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                  onClick={() => onToggleConstruction(construction.id)}
                >
                  <div>
                    <strong className="mobile-group-title">
                      {constructionCollapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )}
                      <ConstructionCompletionIndicator
                        complete={constructionComplete}
                      />
                      <span>{construction.construction}</span>
                    </strong>
                    <span>
                      {[construction.system, construction.status]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Need</dt>
                      <dd>{formatValue(construction.need)}</dd>
                    </div>
                    <div>
                      <dt>Delivered</dt>
                      <dd>{formatValue(construction.delivered)}</dd>
                    </div>
                    <div>
                      <dt>Diff</dt>
                      <dd>{formatValue(construction.diff)}</dd>
                    </div>
                  </dl>
                </button>
                <ConstructionCopyActions
                  construction={construction.construction}
                  system={construction.system}
                />
              </header>
              {!constructionCollapsed &&
                sortedCommanderGroups(construction).map((group) => {
                  const commanderCollapsed = collapsedCommanderIds.has(
                    colonisationCommanderGroupKey(construction.id, group.cmdr),
                  );
                  return (
                    <section key={`${construction.id}-${group.cmdr}`}>
                      <button
                        type="button"
                        className="mobile-commander-heading"
                        aria-expanded={!commanderCollapsed}
                        aria-label={`${commanderCollapsed ? "Expand" : "Collapse"} Cmdr ${group.cmdr}`}
                        onClick={() =>
                          onToggleCommander(construction.id, group.cmdr)
                        }
                      >
                        <strong className="mobile-group-title">
                          {commanderCollapsed ? (
                            <ChevronRight size={14} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={14} aria-hidden="true" />
                          )}
                          <span>Cmdr {group.cmdr}</span>
                        </strong>
                        <dl>
                          <div>
                            <dt>Need</dt>
                            <dd>{formatValue(group.need)}</dd>
                          </div>
                          <div>
                            <dt>Delivered</dt>
                            <dd>{formatValue(group.delivered)}</dd>
                          </div>
                          <div>
                            <dt>Diff</dt>
                            <dd>—</dd>
                          </div>
                        </dl>
                      </button>
                      {!commanderCollapsed &&
                        sortedCommodityRows(group.commodities).map((row) => (
                          <div
                            className={`mobile-commodity-row ${diffClass(row.diff)}`}
                            key={`${construction.id}-${group.cmdr}-${row.commodity.key}`}
                          >
                            <CommodityName
                              name={row.commodity.commodity}
                              colour={
                                colours.get(row.commodity.commodity) ??
                                commodityColours[0]
                              }
                            />
                            <dl>
                              <div>
                                <dt>Need</dt>
                                <dd>{formatValue(row.commodity.need)}</dd>
                              </div>
                              <div>
                                <dt>Delivered</dt>
                                <dd>{formatValue(row.delivered)}</dd>
                              </div>
                              <div>
                                <dt>Diff</dt>
                                <dd>—</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                    </section>
                  );
                })}
            </article>
          );
        })}
      </div>
    </>
  );
}

export function ColonisationCommodityConstructionsTable({
  groups,
  sort,
  onSort,
  collapsedCommodityIds,
  onToggleCommodity,
}: {
  groups: ColonisationCommodityConstructionGroup[];
  sort: ColonisationSort;
  onSort: (key: ColonisationSortKey) => void;
  collapsedCommodityIds: ReadonlySet<string>;
  onToggleCommodity: (commodityKey: string) => void;
}) {
  const numericKeys = ["need", "delivered", "diff"];
  const sortedGroups = sortedBy(
    groups,
    (group) =>
      numericKeys.includes(sort.key)
        ? group[sort.key as "need" | "delivered" | "diff"]
        : group.commodity,
    ["commodity", ...numericKeys].includes(sort.key) ? sort.direction : "asc",
  );
  const sortedConstructions = (group: ColonisationCommodityConstructionGroup) =>
    sortedBy(
      group.constructions,
      ({ construction, commodity }) =>
        sort.key === "system"
          ? construction.system
          : sort.key === "status"
            ? colonisationConstructionStatus(construction.status)
            : numericKeys.includes(sort.key)
              ? commodity[sort.key as "need" | "delivered" | "diff"]
              : construction.construction,
      ["construction", "system", "status", ...numericKeys].includes(sort.key)
        ? sort.direction
        : "asc",
    );

  return (
    <>
      <div className="desktop-table colonisation-grouped-table commodity-constructions-table">
        <table>
          <thead>
            <tr>
              {(
                [
                  ["commodity", "Commodity / Construction"],
                  ["need", "Need"],
                  ["delivered", "Delivered"],
                  ["diff", "Diff"],
                ] as const
              ).map(([key, label]) => (
                <SortHeader
                  key={key}
                  label={label}
                  sortKey={key}
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <ColonisationTotalsRow groups={groups} showNeedDiff />
          {sortedGroups.map((group) => {
            const collapsed = collapsedCommodityIds.has(
              colonisationCommodityConstructionGroupKey(group.key),
            );
            return (
              <tbody key={group.key}>
                <tr className={`commodity-group-row ${diffClass(group.diff)}`}>
                  <th scope="rowgroup">
                    <button
                      type="button"
                      className="colonisation-group-toggle"
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? "Expand" : "Collapse"} commodity ${group.commodity}`}
                      onClick={() => onToggleCommodity(group.key)}
                    >
                      {collapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )}
                      <span className="colonisation-group-label">
                        <CommodityName
                          name={group.commodity}
                          colour="currentColor"
                          showColourChip={false}
                        />
                        <small>
                          {group.constructions.length}{" "}
                          {group.constructions.length === 1
                            ? "construction"
                            : "constructions"}
                        </small>
                      </span>
                    </button>
                  </th>
                  <NumberCell>{formatValue(group.need)}</NumberCell>
                  <NumberCell>{formatValue(group.delivered)}</NumberCell>
                  <NumberCell>{formatValue(group.diff)}</NumberCell>
                </tr>
                {!collapsed &&
                  sortedConstructions(group).map(
                    ({ construction, commodity }) => (
                      <tr
                        key={construction.id}
                        className={`commodity-construction-row ${diffClass(commodity.diff)}`}
                      >
                        <th scope="row">
                          <span
                            className={`contribution-construction-identity ${diffClass(construction.diff)}`}
                          >
                            <ConstructionCompletionIndicator
                              complete={constructionIsComplete(construction)}
                            />
                            <span className="colonisation-group-label">
                              <CopyableValue
                                value={construction.construction}
                                label="Copy construction name"
                              />
                              <small>
                                <CopyableValue
                                  value={construction.system}
                                  label="Copy system name"
                                />
                                <span> · {construction.status}</span>
                              </small>
                            </span>
                          </span>
                        </th>
                        <NumberCell>{formatValue(commodity.need)}</NumberCell>
                        <NumberCell>
                          {formatValue(commodity.delivered)}
                        </NumberCell>
                        <NumberCell>{formatValue(commodity.diff)}</NumberCell>
                      </tr>
                    ),
                  )}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="colonisation-mobile-groups commodity-constructions-mobile-groups">
        <ColonisationMobileTotals groups={groups} showNeedDiff />
        {sortedGroups.map((group) => {
          const collapsed = collapsedCommodityIds.has(
            colonisationCommodityConstructionGroupKey(group.key),
          );
          return (
            <article key={group.key}>
              <header className={diffClass(group.diff)}>
                <button
                  type="button"
                  className="mobile-construction-toggle"
                  aria-expanded={!collapsed}
                  aria-label={`${collapsed ? "Expand" : "Collapse"} commodity ${group.commodity}`}
                  onClick={() => onToggleCommodity(group.key)}
                >
                  <div>
                    <strong className="mobile-group-title">
                      {collapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )}
                      <CommodityName
                        name={group.commodity}
                        colour="currentColor"
                        showColourChip={false}
                      />
                    </strong>
                    <span>
                      {group.constructions.length}{" "}
                      {group.constructions.length === 1
                        ? "construction"
                        : "constructions"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Need</dt>
                      <dd>{formatValue(group.need)}</dd>
                    </div>
                    <div>
                      <dt>Delivered</dt>
                      <dd>{formatValue(group.delivered)}</dd>
                    </div>
                    <div>
                      <dt>Diff</dt>
                      <dd>{formatValue(group.diff)}</dd>
                    </div>
                  </dl>
                </button>
              </header>
              {!collapsed &&
                sortedConstructions(group).map(
                  ({ construction, commodity }) => (
                    <section key={construction.id}>
                      <div
                        className={`mobile-commodity-row ${diffClass(commodity.diff)}`}
                      >
                        <span
                          className={`contribution-construction-identity ${diffClass(construction.diff)}`}
                        >
                          <ConstructionCompletionIndicator
                            complete={constructionIsComplete(construction)}
                          />
                          <span className="colonisation-group-label">
                            <strong>
                              <CopyableValue
                                value={construction.construction}
                                label="Copy construction name"
                              />
                            </strong>
                            <small>
                              <CopyableValue
                                value={construction.system}
                                label="Copy system name"
                              />
                              <span> · {construction.status}</span>
                            </small>
                          </span>
                        </span>
                        <dl>
                          <div>
                            <dt>Need</dt>
                            <dd>{formatValue(commodity.need)}</dd>
                          </div>
                          <div>
                            <dt>Delivered</dt>
                            <dd>{formatValue(commodity.delivered)}</dd>
                          </div>
                          <div>
                            <dt>Diff</dt>
                            <dd>{formatValue(commodity.diff)}</dd>
                          </div>
                        </dl>
                      </div>
                    </section>
                  ),
                )}
            </article>
          );
        })}
      </div>
    </>
  );
}

export function ColonisationCommodityGroupedTable({
  constructions,
  sort,
  onSort,
  collapsedConstructionIds,
  collapsedCommodityIds,
  onToggleConstruction,
  onToggleCommodity,
}: {
  constructions: ColonisationConstruction[];
  sort: ColonisationSort;
  onSort: (key: ColonisationSortKey) => void;
  collapsedConstructionIds: ReadonlySet<string>;
  collapsedCommodityIds: ReadonlySet<string>;
  onToggleConstruction: (constructionId: string) => void;
  onToggleCommodity: (constructionId: string, commodityKey: string) => void;
}) {
  const commodityNames = colonisationCommodityNames(constructions);
  const colours = new Map(
    commodityNames.map((commodity, index) => [
      commodity,
      commodityColours[index % commodityColours.length],
    ]),
  );
  const sortedConstructions = useMemo(
    () =>
      sortedBy(
        constructions,
        (construction) =>
          sort.key === "system"
            ? construction.system
            : sort.key === "status"
              ? colonisationConstructionStatus(construction.status)
              : ["need", "delivered", "diff"].includes(sort.key)
                ? construction[sort.key as "need" | "delivered" | "diff"]
                : construction.construction,
        [
          "construction",
          "system",
          "status",
          "need",
          "delivered",
          "diff",
        ].includes(sort.key)
          ? sort.direction
          : "asc",
      ),
    [constructions, sort],
  );
  const sortedCommodityGroups = (construction: ColonisationConstruction) =>
    sortedBy(
      colonisationCommodityGroups(construction),
      (group) =>
        sort.key === "need"
          ? group.commodity.need
          : sort.key === "delivered"
            ? group.commodity.delivered
            : sort.key === "diff"
              ? group.commodity.diff
              : group.commodity.commodity,
      ["commodity", "need", "delivered", "diff"].includes(sort.key)
        ? sort.direction
        : "asc",
    );
  const sortedContributions = (
    contributions: ReturnType<
      typeof colonisationCommodityGroups
    >[number]["contributions"],
  ) =>
    sortedBy(
      contributions,
      (contribution) =>
        sort.key === "delivered" ? contribution.delivered : contribution.cmdr,
      ["cmdr", "delivered"].includes(sort.key) ? sort.direction : "asc",
    );

  return (
    <>
      <div className="desktop-table colonisation-grouped-table">
        <table>
          <thead>
            <tr>
              {(
                [
                  [
                    "construction",
                    "Construction / Commodity / Cmdr contribution",
                  ],
                  ["need", "Need"],
                  ["delivered", "Delivered"],
                  ["diff", "Diff"],
                ] as const
              ).map(([key, label]) => (
                <SortHeader
                  key={key}
                  label={label}
                  sortKey={key}
                  activeKey={sort.key}
                  direction={sort.direction}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <ColonisationTotalsRow groups={constructions} showNeedDiff />
          {sortedConstructions.map((construction) => {
            const groups = sortedCommodityGroups(construction);
            const constructionCollapsed = collapsedConstructionIds.has(
              construction.id,
            );
            return (
              <tbody key={construction.id}>
                <tr
                  className={`construction-group-row ${diffClass(construction.diff)}`}
                >
                  <th scope="rowgroup">
                    <span className="colonisation-group-cell">
                      <button
                        type="button"
                        className="colonisation-group-toggle construction-group-toggle"
                        aria-expanded={!constructionCollapsed}
                        aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                        onClick={() => onToggleConstruction(construction.id)}
                      >
                        {constructionCollapsed ? (
                          <ChevronRight size={14} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={14} aria-hidden="true" />
                        )}
                        <ConstructionCompletionIndicator
                          complete={constructionIsComplete(construction)}
                        />
                        <span className="colonisation-group-label">
                          <span>{construction.construction}</span>
                          <small>
                            {[construction.system, construction.status]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                      </button>
                      <ConstructionCopyActions
                        construction={construction.construction}
                        system={construction.system}
                      />
                    </span>
                  </th>
                  <NumberCell>{formatValue(construction.need)}</NumberCell>
                  <NumberCell>{formatValue(construction.delivered)}</NumberCell>
                  <NumberCell>{formatValue(construction.diff)}</NumberCell>
                </tr>
                {!constructionCollapsed &&
                  groups.map((group) => {
                    const commodityCollapsed = collapsedCommodityIds.has(
                      colonisationCommodityGroupKey(
                        construction.id,
                        group.commodity.key,
                      ),
                    );
                    return (
                      <Fragment
                        key={`${construction.id}-${group.commodity.key}`}
                      >
                        <tr
                          className={`commodity-group-row ${diffClass(group.commodity.diff)}`}
                        >
                          <th scope="rowgroup">
                            <button
                              type="button"
                              className="colonisation-group-toggle commodity-group-toggle"
                              aria-expanded={!commodityCollapsed}
                              aria-label={`${commodityCollapsed ? "Expand" : "Collapse"} commodity ${group.commodity.commodity}`}
                              onClick={() =>
                                onToggleCommodity(
                                  construction.id,
                                  group.commodity.key,
                                )
                              }
                            >
                              {commodityCollapsed ? (
                                <ChevronRight size={14} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={14} aria-hidden="true" />
                              )}
                              <CommodityName
                                name={group.commodity.commodity}
                                colour={
                                  colours.get(group.commodity.commodity) ??
                                  commodityColours[0]
                                }
                              />
                            </button>
                          </th>
                          <NumberCell>
                            {formatValue(group.commodity.need)}
                          </NumberCell>
                          <NumberCell>
                            {formatValue(group.commodity.delivered)}
                          </NumberCell>
                          <NumberCell>
                            {formatValue(group.commodity.diff)}
                          </NumberCell>
                        </tr>
                        {!commodityCollapsed &&
                          sortedContributions(group.contributions).map(
                            (contribution) => (
                              <tr
                                className="commander-contribution-row"
                                key={`${construction.id}-${group.commodity.key}-${contribution.cmdr}`}
                              >
                                <th scope="row">Cmdr {contribution.cmdr}</th>
                                <NumberCell>—</NumberCell>
                                <NumberCell>
                                  {formatValue(contribution.delivered)}
                                </NumberCell>
                                <NumberCell>—</NumberCell>
                              </tr>
                            ),
                          )}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="colonisation-mobile-groups">
        <ColonisationMobileTotals groups={constructions} showNeedDiff />
        {sortedConstructions.map((construction) => {
          const constructionCollapsed = collapsedConstructionIds.has(
            construction.id,
          );
          return (
            <article key={construction.id}>
              <header className={diffClass(construction.diff)}>
                <button
                  type="button"
                  className="mobile-construction-toggle"
                  aria-expanded={!constructionCollapsed}
                  aria-label={`${constructionCollapsed ? "Expand" : "Collapse"} construction ${construction.construction}`}
                  onClick={() => onToggleConstruction(construction.id)}
                >
                  <div>
                    <strong className="mobile-group-title">
                      {constructionCollapsed ? (
                        <ChevronRight size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )}
                      <ConstructionCompletionIndicator
                        complete={constructionIsComplete(construction)}
                      />
                      <span>{construction.construction}</span>
                    </strong>
                    <span>
                      {[construction.system, construction.status]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Need</dt>
                      <dd>{formatValue(construction.need)}</dd>
                    </div>
                    <div>
                      <dt>Delivered</dt>
                      <dd>{formatValue(construction.delivered)}</dd>
                    </div>
                    <div>
                      <dt>Diff</dt>
                      <dd>{formatValue(construction.diff)}</dd>
                    </div>
                  </dl>
                </button>
                <ConstructionCopyActions
                  construction={construction.construction}
                  system={construction.system}
                />
              </header>
              {!constructionCollapsed &&
                sortedCommodityGroups(construction).map((group) => {
                  const commodityCollapsed = collapsedCommodityIds.has(
                    colonisationCommodityGroupKey(
                      construction.id,
                      group.commodity.key,
                    ),
                  );
                  return (
                    <section key={`${construction.id}-${group.commodity.key}`}>
                      <button
                        type="button"
                        className={`mobile-commodity-heading ${diffClass(group.commodity.diff)}`}
                        aria-expanded={!commodityCollapsed}
                        aria-label={`${commodityCollapsed ? "Expand" : "Collapse"} commodity ${group.commodity.commodity}`}
                        onClick={() =>
                          onToggleCommodity(
                            construction.id,
                            group.commodity.key,
                          )
                        }
                      >
                        <strong className="mobile-group-title">
                          {commodityCollapsed ? (
                            <ChevronRight size={14} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={14} aria-hidden="true" />
                          )}
                          <CommodityName
                            name={group.commodity.commodity}
                            colour={
                              colours.get(group.commodity.commodity) ??
                              commodityColours[0]
                            }
                          />
                        </strong>
                        <dl>
                          <div>
                            <dt>Need</dt>
                            <dd>{formatValue(group.commodity.need)}</dd>
                          </div>
                          <div>
                            <dt>Delivered</dt>
                            <dd>{formatValue(group.commodity.delivered)}</dd>
                          </div>
                          <div>
                            <dt>Diff</dt>
                            <dd>{formatValue(group.commodity.diff)}</dd>
                          </div>
                        </dl>
                      </button>
                      {!commodityCollapsed &&
                        sortedContributions(group.contributions).map(
                          (contribution) => (
                            <div
                              className="mobile-contribution-row"
                              key={`${construction.id}-${group.commodity.key}-${contribution.cmdr}`}
                            >
                              <strong>Cmdr {contribution.cmdr}</strong>
                              <dl className="single-value">
                                <div>
                                  <dt>Delivered</dt>
                                  <dd>{formatValue(contribution.delivered)}</dd>
                                </div>
                              </dl>
                            </div>
                          ),
                        )}
                    </section>
                  );
                })}
            </article>
          );
        })}
      </div>
    </>
  );
}

"use client";

import ReactECharts from "echarts-for-react";
import {
  HOME_ACTIVITY_METRICS,
  contributionPercentage,
  type HomeActivityRow,
  type HomeMetrics,
} from "@/lib/home";
import { formatValue } from "@/lib/utils";

interface TooltipParameter {
  dataIndex?: number;
  seriesName?: string;
  value?: number;
  color?: string;
  data?: {
    rawValue?: number;
    value?: number;
    unit?: string;
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export function HomeActivityChart({
  rows,
  totals,
}: {
  rows: HomeActivityRow[];
  totals: HomeMetrics;
}) {
  const visibleRows = rows.slice(0, 12);
  const commanderNames = visibleRows.map((row) => row.cmdr);
  const chartDescription =
    "Grouped bars showing each commander's percentage share of the current tick totals for influence contribution, bounty vouchers, exploration sales, combat bonds and trade volume.";

  const option = {
    animationDuration: 350,
    color: HOME_ACTIVITY_METRICS.map((metric) => metric.color),
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    aria: {
      enabled: true,
      description: chartDescription,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      className: "home-activity-tooltip",
      confine: true,
      backgroundColor: "#121821",
      borderColor: "#303946",
      textStyle: { color: "#f2f4f7", fontSize: 11 },
      formatter: (parameters: TooltipParameter | TooltipParameter[]) => {
        const items = Array.isArray(parameters) ? parameters : [parameters];
        const dataIndex = items[0]?.dataIndex ?? 0;
        const commander = escapeHtml(
          visibleRows[dataIndex]?.cmdr ?? "Commander",
        );
        const values = items
          .map((item) => {
            const rawValue = Number(item.data?.rawValue) || 0;
            const percentage = Number(item.data?.value ?? item.value) || 0;
            const suffix = item.data?.unit === "credits" ? " Cr" : " points";
            const color = escapeHtml(String(item.color ?? "#e8bd52"));
            const label = escapeHtml(item.seriesName ?? "Activity");
            return `<span style="color:${color}">■</span> ${label}: <strong>${escapeHtml(formatValue(rawValue))}${suffix}</strong> (${percentage.toFixed(1)}%)`;
          })
          .join("<br />");
        return `<strong>${commander}</strong><br />${values}`;
      },
    },
    legend: { show: false },
    grid: { left: 52, right: 18, top: 18, bottom: 58 },
    xAxis: {
      type: "category",
      data: commanderNames,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        interval: 0,
        rotate: 20,
        formatter: (value: string) =>
          value.length > 11 ? `${value.slice(0, 10)}…` : value,
      },
      axisLine: { lineStyle: { color: "#2a323d" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      interval: 25,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        formatter: (value: number) => `${value}%`,
      },
      splitLine: { lineStyle: { color: "#222a34" } },
    },
    series: HOME_ACTIVITY_METRICS.map((metric) => ({
      name: metric.label,
      type: "bar",
      barMaxWidth: 18,
      data: visibleRows.map((row) => ({
        value: contributionPercentage(row[metric.key], totals[metric.key]),
        rawValue: row[metric.key],
        unit: metric.unit,
      })),
    })),
  };

  return (
    <>
      <div
        className="home-chart-scroll"
        tabIndex={0}
        aria-label="Scrollable contribution chart"
      >
        <div className="home-chart-canvas" data-testid="home-activity-chart">
          <ReactECharts
            option={option}
            style={{ height: "100%", minHeight: 300, width: "100%" }}
            notMerge
            lazyUpdate
            opts={{ renderer: "canvas" }}
          />
        </div>
      </div>
      <div className="home-chart-legend" aria-label="Activity metrics">
        {HOME_ACTIVITY_METRICS.map((metric) => (
          <span key={metric.key}>
            <i style={{ backgroundColor: metric.color }} />
            {metric.label}
          </span>
        ))}
      </div>
      <p className="home-chart-context">
        Share of each current-tick total · showing {visibleRows.length} of{" "}
        {rows.length} commanders
      </p>
    </>
  );
}

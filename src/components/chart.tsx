"use client";

import ReactECharts from "echarts-for-react";
import type { FeatureSpec } from "@/lib/features";
import { formatValue } from "@/lib/utils";

export function FeatureChart({
  spec,
  rows,
}: {
  spec: FeatureSpec;
  rows: Record<string, unknown>[];
}) {
  if (!spec.chart) return null;
  const chartRows =
    spec.key === "leaderboard"
      ? [...rows].sort(
          (a, b) =>
            Number(b[spec.chart!.series[0].key] ?? 0) -
            Number(a[spec.chart!.series[0].key] ?? 0),
        )
      : rows;
  const option = {
    animationDuration: 350,
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#121821",
      borderColor: "#303946",
      textStyle: { color: "#f2f4f7" },
    },
    legend: { bottom: 0, textStyle: { color: "#8c96a5", fontSize: 10 } },
    grid: { left: 48, right: 18, top: 20, bottom: 50 },
    xAxis: {
      type: "category",
      data: chartRows
        .slice(0, 12)
        .map((row) => formatValue(row[spec.chart!.category])),
      axisLabel: { color: "#778291", fontSize: 9, interval: 0, rotate: 20 },
      axisLine: { lineStyle: { color: "#2a323d" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        formatter: (value: number) => formatValue(value),
      },
      splitLine: { lineStyle: { color: "#222a34" } },
    },
    color: ["#e8bd52", "#68829b", "#66c28e"],
    series: spec.chart.series.map((item) => ({
      name: item.label,
      type:
        spec.key === "leaderboard" || spec.chart!.series.length > 1
          ? "bar"
          : "line",
      smooth: spec.key !== "leaderboard",
      barMaxWidth: 34,
      data: chartRows.slice(0, 12).map((row) => Number(row[item.key]) || 0),
      areaStyle:
        spec.key !== "leaderboard" && spec.chart!.series.length === 1
          ? { color: "#e8bd5215" }
          : undefined,
    })),
  };
  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: "100%" }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
    />
  );
}

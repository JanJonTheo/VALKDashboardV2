"use client";

import ReactECharts from "echarts-for-react";
import type { EvaluationHistoryPayload } from "@/lib/evaluation-history";
import type { FeatureSpec } from "@/lib/features";
import type { EvaluationChartMode, LeaderboardMetric } from "@/lib/preferences";
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

const evaluationChartColors = [
  "#e8bd52",
  "#73a7cf",
  "#66c28e",
  "#e48668",
  "#a78bdb",
  "#d99c5b",
  "#6fc4bd",
  "#d77f9f",
  "#91a8d0",
  "#a8bd68",
];

export function EvaluationChart({
  mode,
  rows,
  metric,
  metricLabel,
  limit,
  history,
  loading,
  error,
}: {
  mode: EvaluationChartMode;
  rows: Record<string, unknown>[];
  metric: LeaderboardMetric;
  metricLabel: string;
  limit: number;
  history?: EvaluationHistoryPayload;
  loading: boolean;
  error?: string;
}) {
  const totals = [...rows]
    .map((row) => ({
      name: String(row.cmdr ?? "").trim(),
      value: Number(row[metric]) || 0,
    }))
    .filter((row) => row.name)
    .sort(
      (left, right) =>
        right.value - left.value || left.name.localeCompare(right.name, "en"),
    )
    .slice(0, limit);

  if (mode === "history" && loading)
    return (
      <p className="chart-inline-state" role="status">
        Loading historical values…
      </p>
    );
  if (mode === "history" && error)
    return (
      <p className="chart-inline-state chart-inline-error" role="alert">
        {error}
      </p>
    );

  const categories =
    mode === "history"
      ? (history?.buckets.map((bucket) => bucket.label) ?? [])
      : totals.map((row) => row.name);
  const series =
    mode === "history"
      ? (history?.series ?? []).map((item) => ({
          name: item.name,
          type: "line",
          smooth: 0.22,
          showSymbol: categories.length <= 31,
          symbolSize: 5,
          data: item.data,
          emphasis: { focus: "series" },
        }))
      : [
          {
            name: metricLabel,
            type: "bar",
            barMaxWidth: 38,
            data: totals.map((row) => row.value),
          },
        ];

  if (!categories.length || !series.length)
    return (
      <p className="chart-inline-state">No chart data for this selection.</p>
    );

  const option = {
    animationDuration: 350,
    aria: {
      enabled: true,
      description: `${metricLabel} ${mode === "history" ? "history" : "totals"}`,
    },
    textStyle: { fontFamily: "Arial", color: "#9aa4b3" },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#121821",
      borderColor: "#303946",
      textStyle: { color: "#f2f4f7" },
      valueFormatter: (value: number) => formatValue(value),
    },
    legend:
      mode === "history"
        ? {
            type: "scroll",
            bottom: 0,
            textStyle: { color: "#8c96a5", fontSize: 10 },
          }
        : { show: false },
    grid: {
      left: 58,
      right: 22,
      top: 26,
      bottom: mode === "history" ? 64 : 54,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      boundaryGap: mode !== "history",
      data: categories,
      axisLabel: {
        color: "#778291",
        fontSize: 9,
        interval: categories.length > 31 ? "auto" : 0,
        rotate: categories.length > 12 ? 35 : 18,
      },
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
    color: evaluationChartColors,
    series,
  };

  return (
    <>
      <ReactECharts
        option={option}
        style={{ height: 340, width: "100%" }}
        notMerge
        lazyUpdate
        opts={{ renderer: "canvas" }}
      />
      <table className="sr-only">
        <caption>
          {metricLabel} {mode === "history" ? "history" : "totals"}
        </caption>
        <thead>
          <tr>
            <th>Commander</th>
            {mode === "history" ? (
              categories.map((category) => <th key={category}>{category}</th>)
            ) : (
              <th>{metricLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {mode === "history"
            ? history?.series.map((item) => (
                <tr key={item.name}>
                  <th>{item.name}</th>
                  {item.data.map((value, index) => (
                    <td key={history.buckets[index]?.key ?? index}>
                      {formatValue(value)}
                    </td>
                  ))}
                </tr>
              ))
            : totals.map((item) => (
                <tr key={item.name}>
                  <th>{item.name}</th>
                  <td>{formatValue(item.value)}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </>
  );
}

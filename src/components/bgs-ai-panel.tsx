"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import type { BgsAiReport, BgsAiReportType } from "@/lib/bgs-rules";

async function loadReports(system: string): Promise<BgsAiReport[]> {
  const response = await fetch(
    `/api/bgs-ai?${new URLSearchParams({ system })}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as {
    data?: BgsAiReport[];
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "AI reports could not be loaded");
  return payload.data ?? [];
}

async function createReport(system_name: string, report_type: BgsAiReportType) {
  const response = await fetch("/api/bgs-ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system_name, report_type }),
  });
  const payload = (await response.json()) as {
    data?: BgsAiReport;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "AI analysis failed");
  return payload.data;
}

function ReportValue({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "object" && item ? (
              <ReportValue value={item} />
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  if (value && typeof value === "object")
    return (
      <dl>
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>
              <ReportValue value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <>{String(value ?? "—")}</>;
}

export function BgsAiPanel({
  system,
  canRun,
}: {
  system: string;
  canRun: boolean;
}) {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["bgs-ai-reports", system],
    queryFn: () => loadReports(system),
  });
  const mutation = useMutation({
    mutationFn: ({ type }: { type: BgsAiReportType }) =>
      createReport(system, type),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["bgs-ai-reports", system] }),
  });
  return (
    <section className="bgs-ai-panel">
      <header>
        <Bot size={20} />
        <div>
          <h3>BGS AI intelligence</h3>
          <p>
            Manual reports use settled EDDN data and the shared Spansh cache.
          </p>
        </div>
      </header>
      {canRun && (
        <div className="bgs-ai-actions">
          <button
            className="secondary-button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ type: "risk" })}
          >
            <ShieldAlert size={14} /> Analyze risks &amp; opportunities
          </button>
          <button
            className="secondary-button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ type: "strategy" })}
          >
            <Sparkles size={14} /> Create takeover strategy
          </button>
          {mutation.isPending && (
            <span>
              <RefreshCw className="spin" size={13} /> OpenAI analysis in
              progress…
            </span>
          )}
        </div>
      )}
      {!canRun && (
        <p className="inline-empty">
          Leadership or admin access is required to create reports. Stored
          tenant reports remain visible.
        </p>
      )}
      {(reports.isError || mutation.isError) && (
        <p className="form-error" role="alert">
          {reports.error?.message ?? mutation.error?.message}
        </p>
      )}
      <div className="bgs-report-history">
        {reports.isPending && (
          <p className="inline-empty">Loading report history…</p>
        )}
        {!reports.isPending && !reports.data?.length && (
          <p className="inline-empty">No stored reports for this system.</p>
        )}
        {reports.data?.map((report) => (
          <details key={report.id}>
            <summary>
              <strong>
                {report.report_type === "risk"
                  ? "Risk & opportunity analysis"
                  : "Takeover strategy"}
              </strong>
              <span>
                {new Date(report.created_at).toLocaleString("en-GB")} ·{" "}
                {report.model}
              </span>
            </summary>
            <div className="bgs-report-body">
              <ReportValue value={report.report} />
            </div>
            <footer>
              Settled tick {report.source_ticktime || "unknown"}
              {report.requested_by
                ? ` · requested by ${report.requested_by}`
                : ""}
            </footer>
          </details>
        ))}
      </div>
    </section>
  );
}

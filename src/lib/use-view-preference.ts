"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureSpec } from "./features";
import {
  defaultViewPreference,
  preferencePayload,
  type ViewPreference,
} from "./preferences";

interface PreferenceEnvelope {
  data: { schema_version: number; payload: unknown; updated_at: string } | null;
}

async function loadPreference(viewKey: string): Promise<PreferenceEnvelope> {
  const response = await fetch(
    `/api/preferences/${encodeURIComponent(viewKey)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Saved view could not be loaded");
  return response.json();
}

function variantKey(spec: FeatureSpec) {
  if (spec.key === "evaluations") return "mode";
  if (spec.key === "colonisation") return "view";
  if (spec.key === "cz-summary") return "type";
  return null;
}

export function useViewPreference(
  spec: FeatureSpec,
  searchParams: ReadonlyURLSearchParams,
) {
  const defaults = useMemo(
    () =>
      defaultViewPreference(
        spec.key,
        spec.columns.map((column) => column.key),
      ),
    [spec],
  );
  const [view, setView] = useState<ViewPreference>(defaults);
  const [ready, setReady] = useState(false);
  const skipSave = useRef(true);
  const preference = useQuery({
    queryKey: ["preference", spec.key],
    queryFn: () => loadPreference(spec.key),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (ready || preference.isPending) return;
    const saved = preferencePayload(preference.data?.data?.payload) ?? defaults;
    const next: ViewPreference = { ...saved, filters: { ...saved.filters } };
    if (searchParams.has("period"))
      next.period = searchParams.get("period") || defaults.period;
    if (spec.key === "leaderboard" && searchParams.has("metric")) {
      const explicit = preferencePayload({
        ...next,
        metric: searchParams.get("metric"),
      });
      if (explicit?.metric) next.metric = explicit.metric;
    }
    for (const filter of spec.filters) {
      if (filter.key === "period") continue;
      if (searchParams.has(filter.key))
        next.filters[filter.key] = searchParams.get(filter.key) ?? "";
    }
    const key = variantKey(spec);
    if (key && searchParams.has(key))
      next.variant = searchParams.get(key) ?? undefined;
    const explicitPageSize = Number(searchParams.get("page_size"));
    if (
      Number.isInteger(explicitPageSize) &&
      explicitPageSize >= 10 &&
      explicitPageSize <= 250
    )
      next.pageSize = explicitPageSize;
    const timer = window.setTimeout(() => {
      setView(next);
      skipSave.current = true;
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    defaults,
    preference.data,
    preference.isPending,
    ready,
    searchParams,
    spec,
  ]);

  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/preferences/${encodeURIComponent(spec.key)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(view),
        signal: controller.signal,
      });
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ready, spec.key, view]);

  const effectiveParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (view.period) params.set("period", view.period);
    if (view.metric) params.set("metric", view.metric);
    for (const filter of spec.filters) {
      if (filter.key === "period") continue;
      const value = view.filters[filter.key]?.trim();
      if (value) params.set(filter.key, value);
      else params.delete(filter.key);
    }
    const key = variantKey(spec);
    if (key && view.variant) params.set(key, view.variant);
    if (spec.key === "data-explorer")
      params.set("page_size", String(view.pageSize));
    return params;
  }, [searchParams, spec, view]);

  const reset = async () => {
    await fetch(`/api/preferences/${encodeURIComponent(spec.key)}`, {
      method: "DELETE",
    });
    skipSave.current = true;
    setView(defaults);
  };

  return {
    view,
    setView,
    ready,
    effectiveParams,
    reset,
    preferenceError: preference.isError,
  };
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { FeatureSpec } from "./features";
import {
  defaultViewCollection,
  defaultViewPreference,
  maximumSavedViews,
  preferenceSchemaVersion,
  viewCollectionPayload,
  viewFilterValues,
  viewPreferenceSchema,
  viewPreferencesEqual,
  type ViewCollection,
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
  if (!response.ok) throw new Error("Saved views could not be loaded");
  return response.json();
}

function normalizeViewName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Enter a name for this view");
  if (normalized.length > 64)
    throw new Error("View names may contain at most 64 characters");
  return normalized;
}

function createViewId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `view-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function useStoredViewPreference(
  viewKey: string,
  defaults: ViewPreference,
  hydrate?: (view: ViewPreference, schemaVersion: number) => ViewPreference,
  legacyViewKey?: string,
) {
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<ViewCollection>(() =>
    defaultViewCollection(defaults),
  );
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const skipSave = useRef(true);
  const immediateSave = useRef(false);
  const interactedBeforeReady = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const confirmedCollection = useRef<ViewCollection>(
    defaultViewCollection(defaults),
  );
  const preference = useQuery({
    queryKey: ["preference", viewKey],
    queryFn: async () => {
      const response = await loadPreference(viewKey);
      if (response.data || !legacyViewKey) return response;
      const legacy = await loadPreference(legacyViewKey).catch(() => null);
      const parsed = viewPreferenceSchema.safeParse(legacy?.data?.payload);
      if (!legacy?.data || !parsed.success) return response;
      return {
        data: {
          ...legacy.data,
          payload: {
            ...defaults,
            ...parsed.data,
            variant: parsed.data.variant ?? defaults.variant,
          },
        },
      };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (ready || preference.isPending) return;
    const stored = viewCollectionPayload(
      preference.data?.data?.payload,
      defaults,
    );
    const schemaVersion =
      preference.data?.data?.schema_version ?? preferenceSchemaVersion;
    const current = hydrate
      ? hydrate(stored.current, schemaVersion)
      : stored.current;
    const hydrated = viewPreferencesEqual(current, stored.current)
      ? stored
      : { ...stored, current, activeViewId: null };
    confirmedCollection.current = stored;
    const timer = window.setTimeout(() => {
      setCollection((current) =>
        interactedBeforeReady.current
          ? {
              ...stored,
              current: current.current,
              activeViewId: null,
            }
          : hydrated,
      );
      skipSave.current = true;
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaults, hydrate, preference.data, preference.isPending, ready]);

  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const delay = immediateSave.current ? 0 : 500;
    immediateSave.current = false;
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch(
            `/api/preferences/${encodeURIComponent(viewKey)}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(collection),
            },
          );
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: { message?: string };
            } | null;
            throw new Error(
              payload?.error?.message ?? "Saved views could not be updated",
            );
          }
          confirmedCollection.current = collection;
          queryClient.setQueryData(["preference", viewKey], {
            data: {
              schema_version: preferenceSchemaVersion,
              payload: collection,
              updated_at: new Date().toISOString(),
            },
          });
          setSaveError(undefined);
        })
        .catch((error: unknown) => {
          setSaveError(
            error instanceof Error
              ? error.message
              : "Saved views could not be updated",
          );
          setCollection((current) => {
            if (current !== collection) return current;
            skipSave.current = true;
            const confirmed = confirmedCollection.current;
            return {
              ...confirmed,
              current: current.current,
              activeViewId: confirmed.views.some(
                (view) => view.id === current.activeViewId,
              )
                ? current.activeViewId
                : null,
            };
          });
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [collection, queryClient, ready, viewKey]);

  const setView: Dispatch<SetStateAction<ViewPreference>> = useCallback(
    (change) => {
      interactedBeforeReady.current = true;
      setCollection((current) => ({
        ...current,
        current:
          typeof change === "function" ? change(current.current) : change,
      }));
    },
    [],
  );

  const applyView = useCallback((id: string) => {
    immediateSave.current = true;
    setCollection((current) => {
      const saved = current.views.find((view) => view.id === id);
      return saved
        ? {
            ...current,
            current: structuredClone(saved.view),
            activeViewId: saved.id,
          }
        : current;
    });
  }, []);

  const currentView = collection.current;
  const savedViews = collection.views;
  const saveAs = useCallback(
    (rawName: string) => {
      const name = normalizeViewName(rawName);
      if (savedViews.length >= maximumSavedViews)
        throw new Error(`A page can contain up to ${maximumSavedViews} views`);
      if (
        savedViews.some(
          (view) =>
            view.name.toLocaleLowerCase("en") === name.toLocaleLowerCase("en"),
        )
      )
        throw new Error("A view with this name already exists");
      const now = new Date().toISOString();
      const saved = {
        id: createViewId(),
        name,
        view: structuredClone(currentView),
        createdAt: now,
        updatedAt: now,
      };
      immediateSave.current = true;
      setCollection((current) => ({
        ...current,
        activeViewId: saved.id,
        views: [...current.views, saved],
      }));
    },
    [currentView, savedViews],
  );

  const updateActive = useCallback(() => {
    immediateSave.current = true;
    setCollection((current) => ({
      ...current,
      views: current.views.map((view) =>
        view.id === current.activeViewId
          ? {
              ...view,
              view: structuredClone(current.current),
              updatedAt: new Date().toISOString(),
            }
          : view,
      ),
    }));
  }, []);

  const renameView = useCallback(
    (id: string, rawName: string) => {
      const name = normalizeViewName(rawName);
      if (
        collection.views.some(
          (view) =>
            view.id !== id &&
            view.name.toLocaleLowerCase("en") === name.toLocaleLowerCase("en"),
        )
      )
        throw new Error("A view with this name already exists");
      immediateSave.current = true;
      setCollection((current) => ({
        ...current,
        views: current.views.map((view) =>
          view.id === id
            ? { ...view, name, updatedAt: new Date().toISOString() }
            : view,
        ),
      }));
    },
    [collection.views],
  );

  const deleteView = useCallback((id: string) => {
    immediateSave.current = true;
    setCollection((current) => ({
      ...current,
      activeViewId: current.activeViewId === id ? null : current.activeViewId,
      views: current.views.filter((view) => view.id !== id),
    }));
  }, []);

  const reset = useCallback(() => {
    immediateSave.current = true;
    setCollection((current) => ({
      ...current,
      current: structuredClone(defaults),
      activeViewId: null,
    }));
  }, [defaults]);

  const activeView = collection.views.find(
    (view) => view.id === collection.activeViewId,
  );
  const dirty = Boolean(
    activeView && !viewPreferencesEqual(collection.current, activeView.view),
  );

  return {
    view: collection.current,
    setView,
    collection,
    activeView,
    dirty,
    ready,
    reset,
    applyView,
    saveAs,
    updateActive,
    renameView,
    deleteView,
    preferenceError: preference.isError,
    saveError,
  };
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
  const hydrate = useCallback(
    (stored: ViewPreference, schemaVersion: number) => {
      const next: ViewPreference = {
        ...stored,
        filters: { ...stored.filters },
      };
      if (spec.key === "evaluations" && schemaVersion < 5)
        next.visibleColumns = [...defaults.visibleColumns];
      if (searchParams.has("q")) next.search = searchParams.get("q") ?? "";
      if (searchParams.has("period"))
        next.period = searchParams.get("period") || defaults.period;
      if (
        ["leaderboard", "evaluations"].includes(spec.key) &&
        searchParams.has("metric")
      ) {
        const metric = searchParams.get("metric");
        const parsed = viewPreferenceForMetric(next, metric);
        if (parsed) next.metric = parsed;
      }
      if (spec.key === "evaluations" && searchParams.has("chart")) {
        const parsed = viewPreferenceSchema.safeParse({
          ...next,
          chartMode: searchParams.get("chart"),
        });
        if (parsed.success) next.chartMode = parsed.data.chartMode;
      }
      for (const filter of spec.filters) {
        if (filter.key === "period") continue;
        if (searchParams.has(filter.key))
          next.filters[filter.key] =
            filter.type === "multiselect"
              ? searchParams.getAll(filter.key)
              : (searchParams.get(filter.key) ?? "");
      }
      const key = variantKey(spec);
      if (key && searchParams.has(key))
        next.variant = searchParams.get(key) ?? undefined;
      const pageSize = Number(searchParams.get("page_size"));
      if (Number.isInteger(pageSize) && pageSize >= 10 && pageSize <= 250)
        next.pageSize = pageSize;
      return next;
    },
    [defaults, searchParams, spec],
  );
  const stored = useStoredViewPreference(spec.key, defaults, hydrate);

  const effectiveParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (stored.view.search) params.set("q", stored.view.search);
    else params.delete("q");
    if (stored.view.period) params.set("period", stored.view.period);
    if (stored.view.metric) params.set("metric", stored.view.metric);
    if (spec.key === "evaluations" && stored.view.chartMode)
      params.set("chart", stored.view.chartMode);
    for (const filter of spec.filters) {
      if (filter.key === "period") continue;
      const values = viewFilterValues(stored.view.filters[filter.key]);
      params.delete(filter.key);
      if (filter.type === "multiselect")
        for (const value of values) params.append(filter.key, value);
      else if (values[0]) params.set(filter.key, values[0]);
    }
    const key = variantKey(spec);
    if (key && stored.view.variant) params.set(key, stored.view.variant);
    if (spec.key === "data-explorer")
      params.set("page_size", String(stored.view.pageSize));
    return params;
  }, [searchParams, spec, stored.view]);

  return { ...stored, effectiveParams };
}

function viewPreferenceForMetric(
  view: ViewPreference,
  metric: string | null,
): ViewPreference["metric"] {
  if (!metric) return undefined;
  const parsed = viewPreferenceSchema.safeParse({ ...view, metric });
  return parsed.success ? parsed.data.metric : undefined;
}

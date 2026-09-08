"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  normalizeWatchedSystems,
  type WatchedSystem,
} from "./system-watchlist";
import { factionKey } from "./alert-context";

export function useAlertSystems(systems: string[]) {
  const listRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState<string[]>([]);
  const signature = systems.join("\n");
  const queryClient = useQueryClient();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const names = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => (entry.target as HTMLElement).dataset.alertSystem!)
          .filter(Boolean);
        if (names.length)
          setVisible((current) => [...new Set([...current, ...names])]);
      },
      { rootMargin: "200px" },
    );
    listRef.current
      ?.querySelectorAll("[data-alert-system]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [signature]);
  const requested = [
    ...new Map(
      visible
        .filter((name) => systems.includes(name))
        .map((name) => [factionKey(name), name]),
    ).values(),
  ].sort();
  const query = useQuery({
    queryKey: ["alert-system-batch", requested],
    enabled: requested.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const result = new Map<string, WatchedSystem>();
      const missing: string[] = [];
      for (const name of requested) {
        const state = queryClient.getQueryState<WatchedSystem>([
          "system-record-detail",
          name,
        ]);
        if (state?.data && Date.now() - state.dataUpdatedAt < 60_000)
          result.set(factionKey(name), state.data);
        else missing.push(name);
      }
      for (let index = 0; index < missing.length; index += 100) {
        const names = missing.slice(index, index + 100);
        const response = await fetch("/api/system-watchlist/detail", {
          method: "POST",
          signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ systems: names }),
        });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error?.message ?? "Current system data is unavailable",
          );
        const found = normalizeWatchedSystems(payload);
        for (const name of names) {
          const system = found.find(
            (item) => factionKey(item.name) === factionKey(name),
          );
          if (system) {
            result.set(factionKey(name), system);
            queryClient.setQueryData(["system-record-detail", name], system);
          }
        }
      }
      return result;
    },
  });
  const lookup = (name: string) =>
    query.data?.get(factionKey(name)) ??
    queryClient.getQueryData<WatchedSystem>(["system-record-detail", name]);
  return { listRef, lookup, failed: query.isError, pending: query.isFetching };
}

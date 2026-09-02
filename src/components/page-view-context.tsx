"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DashboardLoadingIndicator } from "@/components/dashboard-loading-indicator";

export interface PageViewController {
  reset: () => void | Promise<void>;
  refresh: () => unknown | Promise<unknown>;
}

interface PageViewContextValue {
  register: (controller: PageViewController) => () => void;
  resetAndRefresh: () => Promise<void>;
  refreshing: boolean;
  updatedLabel: string;
}

const PageViewContext = createContext<PageViewContextValue | null>(null);

export function PageViewProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const controller = useRef<PageViewController | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const register = useCallback((next: PageViewController) => {
    controller.current = next;
    return () => {
      if (controller.current === next) controller.current = undefined;
    };
  }, []);

  const resetAndRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(false);
    try {
      if (controller.current) {
        await controller.current.reset();
        await controller.current.refresh();
      } else {
        await queryClient.invalidateQueries();
      }
      setUpdatedAt(Date.now());
      setNow(Date.now());
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refreshing]);

  const elapsedSeconds = Math.floor((now - updatedAt) / 1000);
  const updatedLabel = refreshError
    ? "Update failed"
    : elapsedSeconds < 60
      ? "Updated just now"
      : `Updated ${Math.floor(elapsedSeconds / 60)}m ago`;
  const value = useMemo(
    () => ({ register, resetAndRefresh, refreshing, updatedLabel }),
    [register, resetAndRefresh, refreshing, updatedLabel],
  );

  return (
    <PageViewContext.Provider value={value}>
      <DashboardLoadingIndicator pageRefreshing={refreshing} />
      {children}
    </PageViewContext.Provider>
  );
}

export function usePageViewActions() {
  const value = useContext(PageViewContext);
  if (!value) throw new Error("PageViewProvider is missing");
  return value;
}

export function usePageViewRegistration(controller: PageViewController) {
  const context = useContext(PageViewContext);
  const register = context?.register;
  const controllerRef = useRef(controller);
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);
  useEffect(() => {
    if (!register) return;
    return register({
      reset: () => controllerRef.current.reset(),
      refresh: () => controllerRef.current.refresh(),
    });
  }, [register]);
}

export function PageViewRegistration({
  controller,
}: {
  controller: PageViewController;
}) {
  usePageViewRegistration(controller);
  return null;
}

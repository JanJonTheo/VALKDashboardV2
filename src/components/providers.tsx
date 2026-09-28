"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PageViewProvider } from "@/components/page-view-context";
import { retryDashboardQuery } from "@/lib/dashboard-request";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: retryDashboardQuery,
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            placeholderData: (previous: unknown) => previous,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PageViewProvider>{children}</PageViewProvider>
    </QueryClientProvider>
  );
}

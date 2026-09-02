import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PageViewProvider,
  PageViewRegistration,
  usePageViewActions,
} from "@/components/page-view-context";

function ResetButton() {
  const { resetAndRefresh, updatedLabel } = usePageViewActions();
  return <button onClick={() => void resetAndRefresh()}>{updatedLabel}</button>;
}

function PendingOperations({
  load,
  save,
}: {
  load: () => Promise<string>;
  save: () => Promise<string>;
}) {
  useQuery({ queryKey: ["global-loading-test"], queryFn: load });
  const mutation = useMutation({ mutationFn: save });
  return <button onClick={() => mutation.mutate()}>Save</button>;
}

describe("page view refresh controller", () => {
  it("resets the active view before refreshing its data", async () => {
    const calls: string[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PageViewProvider>
          <PageViewRegistration
            controller={{
              reset: () => {
                calls.push("reset");
              },
              refresh: () => {
                calls.push("refresh");
              },
            }}
          />
          <ResetButton />
        </PageViewProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Updated just now" }));
    await waitFor(() => expect(calls).toEqual(["reset", "refresh"]));
  });

  it("shows the global indicator for queries and mutations", async () => {
    let finishLoad: ((value: string) => void) | undefined;
    let finishSave: ((value: string) => void) | undefined;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <PageViewProvider>
          <PendingOperations
            load={() =>
              new Promise<string>((resolve) => {
                finishLoad = resolve;
              })
            }
            save={() =>
              new Promise<string>((resolve) => {
                finishSave = resolve;
              })
            }
          />
        </PageViewProvider>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("status", {
        name: "Dashboard data is loading",
      }),
    ).toHaveTextContent("Loading data");
    finishLoad?.("loaded");
    await waitFor(() =>
      expect(
        screen.queryByRole("status", {
          name: "Dashboard data is loading",
        }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByRole("status", {
        name: "Dashboard data is loading",
      }),
    ).toHaveTextContent("Updating dashboard");
    finishSave?.("saved");
    await waitFor(() =>
      expect(
        screen.queryByRole("status", {
          name: "Dashboard data is loading",
        }),
      ).not.toBeInTheDocument(),
    );
    client.clear();
  });
});

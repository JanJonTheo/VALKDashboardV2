import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AlertLifecycleActions } from "@/components/alert-lifecycle-actions";
import type { BgsAlert } from "@/lib/bgs-rules";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const alert = {
  id: "a",
  can_manage: true,
  title: "Influence loss",
  system_name: "Sol",
  owner_scope: "tenant",
  resolved_at: null,
} as BgsAlert;
function show(value = alert) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <AlertLifecycleActions alert={value} />
    </QueryClientProvider>,
  );
  return invalidate;
}
it("hides actions without server-granted permission", () => {
  show({ ...alert, can_manage: false });
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("resolves and refreshes the shared counters", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  const event = vi.spyOn(window, "dispatchEvent");
  const invalidate = show();
  fireEvent.click(screen.getByRole("button", { name: "Mark resolved" }));
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
  expect(fetcher).toHaveBeenCalledWith("/api/bgs-alerts/a/resolve", {
    method: "POST",
  });
  expect(event).toHaveBeenCalledWith(
    expect.objectContaining({ type: "valk:alerts-updated" }),
  );
});
it("confirms tenant-wide deletion and honors cancellation", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  show({ ...alert, resolved_at: "2026-09-11" });
  expect(
    screen.queryByRole("button", { name: "Mark resolved" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(confirm).toHaveBeenCalledWith(
    expect.stringContaining("everyone in this tenant"),
  );
  expect(fetcher).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith("/api/bgs-alerts/a", {
      method: "DELETE",
    }),
  );
});
it("shows upstream errors and permits retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "Forbidden" } }),
      }),
  );
  show();
  fireEvent.click(screen.getByRole("button", { name: "Mark resolved" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  expect(screen.getByRole("button", { name: "Mark resolved" })).toBeEnabled();
});

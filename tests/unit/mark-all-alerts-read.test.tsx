import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MarkAllAlertsRead } from "@/components/mark-all-alerts-read";
import { RolePermissionsHelp } from "@/components/role-permissions-help";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function show(isAdmin = true, onMarked = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MarkAllAlertsRead isAdmin={isAdmin} onMarked={onMarked} />
    </QueryClientProvider>,
  );
}
it("hides the bulk action for non-admins", () => {
  show(false);
  expect(screen.queryByRole("button")).toBeNull();
});
it("cancels without a request and submits once after confirmation", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ updated_count: 205 }),
  });
  vi.stubGlobal("fetch", fetcher);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const onMarked = vi.fn();
  show(true, onMarked);
  fireEvent.click(screen.getByRole("button"));
  expect(fetcher).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(205));
  expect(screen.queryByRole("status")).toBeNull();
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/bgs-alerts/read-all", {
    method: "POST",
  });
});
it("reports failures without claiming success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Forbidden" } }),
    }),
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
  show();
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  expect(screen.queryByRole("status")).toBeNull();
});
it("opens the role matrix and distinguishes admin-only bulk read", () => {
  render(<RolePermissionsHelp />);
  fireEvent.click(screen.getByRole("button", { name: "Roles & permissions" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  const row = screen.getByRole("row", { name: /Mark all visible alerts/ });
  expect(row).toHaveTextContent("NoNoYes");
});

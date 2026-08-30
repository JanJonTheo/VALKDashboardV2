import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BgsRuleCatalog } from "@/components/bgs-rule-catalog";

const template = {
  id: "bgs-tenant-faction-early-warning",
  name: "Tenant Faction Early Warning",
  description: "Warn about tenant-faction risk transitions.",
  version: 1,
  default_discord: true,
  archived: false,
  archived_at: null,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
  packages: [],
  items: [
    {
      key: "tenant-loss",
      name: "Tenant faction influence loss",
      condition: {
        type: "tenant_faction_loss",
        threshold_pp: 3,
        comparison: "previous_settled_tick",
      },
      severity: "warning",
    },
    {
      key: "tenant-conflict",
      name: "Tenant faction entered a new conflict",
      condition: {
        type: "tenant_faction_new_conflict",
        conflict_types: ["election", "war"],
      },
      severity: "warning",
    },
    {
      key: "tenant-below",
      name: "Tenant faction below 5% influence",
      condition: { type: "tenant_faction_below", threshold_pp: 5 },
      severity: "critical",
    },
    {
      key: "tenant-gap",
      name: "Faction closes the gap",
      condition: {
        type: "tenant_faction_gap",
        threshold_pp: 2,
        gap_mode: "absolute",
      },
      severity: "warning",
    },
  ],
};

describe("BGS rule catalog", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.startsWith("/api/bgs-rule-templates") && !init?.method)
            return Response.json({
              data: [template],
              discord_availability: { personal: true, global: false },
              can_manage_templates: false,
              can_apply_global: false,
              generated_at: "2026-08-30T00:00:00Z",
            });
          if (url.endsWith("/apply") && init?.method === "POST")
            return Response.json(
              {
                data: {
                  id: "package-1",
                  template_id: template.id,
                  template_version: 1,
                  owner_scope: "personal",
                  owner_user_id: "1",
                  watchlist_scope: "personal",
                  personal_discord: true,
                  tenant_discord: false,
                  rules: [],
                  created_at: "2026-08-30T00:00:00Z",
                  updated_at: "2026-08-30T00:00:00Z",
                },
                already_applied: false,
              },
              { status: 201 },
            );
          return Response.json(
            { error: { message: "Unexpected request" } },
            { status: 500 },
          );
        },
      );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the seeded package and applies it with personal Discord preselected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <BgsRuleCatalog canManageTenant={false} />
      </QueryClientProvider>,
    );

    await screen.findByText("Tenant Faction Early Warning");
    expect(
      screen.getByText("Tenant faction loses influence · 3 pp"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New template" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
    expect(
      screen.getByLabelText("Send to the personal Discord webhook"),
    ).toBeChecked();
    expect(screen.getByLabelText("Watchlist")).not.toHaveTextContent("Global");
    fireEvent.click(screen.getByRole("button", { name: "Apply package" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/apply") &&
            init?.method === "POST" &&
            JSON.parse(String(init.body)).discord === true,
        ),
      ).toBe(true),
    );
    queryClient.clear();
  });
});

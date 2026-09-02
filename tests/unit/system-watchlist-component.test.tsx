import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  factionFillStyle,
  SystemWatchlist,
} from "@/components/system-watchlist";

vi.mock("echarts-for-react", () => ({
  default: () => <div data-testid="influence-chart" />,
}));

const globalPayload = {
  data: [
    {
      requested_system: "Alpha",
      available: true,
      system_info: {
        system_name: "Alpha",
        controlling_faction: "East India Company",
        allegiance: "Empire",
        government: "$government_Corporate;",
        population: 42,
        updated_at: "2026-08-30T00:00:00Z",
      },
      factions: [
        {
          name: "East India Company",
          influence: 0.42,
          allegiance: "Empire",
          government: "Corporate",
          active_states: ["Boom"],
          pending_states: ["Election"],
        },
      ],
      history: [],
      conflicts: [
        {
          faction1: "East India Company",
          faction2: "Alpha Independents",
          war_type: "CivilWar",
          status: "active",
        },
      ],
      powerplays: [],
    },
  ],
  generated_at: "2026-08-30T00:00:00Z",
  pagination: { page: 1, page_size: 25, total: 1 },
  filter_options: {
    allegiances: [{ value: "Empire", label: "Empire" }],
    governments: [{ value: "$government_Corporate;", label: "Corporate" }],
  },
};

const protectedPayload = {
  ...globalPayload,
  data: [
    {
      ...globalPayload.data[0],
      requested_system: "Guardian",
      system_info: {
        ...globalPayload.data[0].system_info,
        system_name: "Guardian",
      },
      factions: [
        {
          name: "Aegis Shield",
          influence: 0.24,
          allegiance: "Independent",
          government: "Cooperative",
          active_states: [],
          pending_states: [],
        },
      ],
    },
  ],
  protected_factions: [
    {
      id: 7,
      name: "Aegis Shield",
      description: "Protected ally",
      webhook_configured: true,
    },
  ],
  selected_protected_faction_id: null,
};

describe("SystemWatchlist scopes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/api/preferences/bgs-system-watchlist-sort"))
            return Response.json({ data: null });
          if (url === "/api/system-watchlist/data")
            return Response.json({
              watchlist: [],
              data: [],
              generated_at: "2026-08-30T00:00:00Z",
            });
          if (url.startsWith("/api/system-watchlist/global?"))
            return Response.json(globalPayload);
          if (url.startsWith("/api/system-watchlist/protected?"))
            return Response.json({
              ...protectedPayload,
              selected_protected_faction_id: url.includes(
                "protected_faction_id=7",
              )
                ? 7
                : null,
            });
          if (url.startsWith("/api/system-watchlist/stations?"))
            return Response.json({
              data: {
                system: "Alpha",
                source: "Spansh",
                source_url: "https://spansh.co.uk/system/1",
                cache_status: "HIT",
                stations: [
                  {
                    id: "1",
                    market_id: "1",
                    name: "Alpha Gateway",
                    carrier_name: "",
                    carrier_owner: "",
                    type: "Coriolis Starport",
                    is_settlement: false,
                    distance_to_arrival: 120,
                    body: "",
                    latitude: null,
                    longitude: null,
                    controlling_faction: "East India Company",
                    allegiance: "Empire",
                    government: "Corporate",
                    economy: "Industrial",
                    second_economy: "",
                    services: [],
                    have_market: true,
                    have_shipyard: false,
                    have_outfitting: false,
                    updated_at: "2026-08-30T00:00:00Z",
                  },
                  {
                    id: "2",
                    market_id: "2",
                    name: "G4K-N8L",
                    carrier_name: "[VALK] Graf Zeppelin",
                    carrier_owner: "",
                    type: "Drake-Class Carrier",
                    is_settlement: false,
                    distance_to_arrival: 450,
                    body: "",
                    latitude: null,
                    longitude: null,
                    controlling_faction: "FleetCarrier",
                    allegiance: "",
                    government: "",
                    economy: "Carrier",
                    second_economy: "",
                    services: [],
                    have_market: true,
                    have_shipyard: true,
                    have_outfitting: true,
                    updated_at: "2026-08-30T00:00:00Z",
                  },
                ],
              },
            });
          if (url === "/api/system-watchlist" && init?.method === "PUT")
            return Response.json({ data: {} });
          return Response.json({ data: [] });
        },
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("maps known faction allegiances to the card watermark", () => {
    for (const [allegiance, asset] of [
      ["Empire", "empire.svg"],
      ["Federation", "federation.svg"],
      ["Alliance", "alliance.svg"],
      ["Independent", "independent.webp"],
    ] as const)
      expect(
        factionFillStyle({ influence: 50, allegiance }, "#fff")[
          "--superpower-icon"
        ],
      ).toContain(`/superpowers/${asset}`);
    expect(
      factionFillStyle({ influence: 50, allegiance: "Unknown" }, "#fff")[
        "--superpower-icon"
      ],
    ).toBeUndefined();
    expect(
      factionFillStyle(
        { influence: 50, allegiance: "$factionallegiance_Empire;" },
        "#fff",
      )["--superpower-icon"],
    ).toContain("/superpowers/empire.svg");
  });

  it("starts personal, opens the global filter sheet and adds a system", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SystemWatchlist
          tenantFactionName="East India Company"
          canManageTenantRules={false}
          canRunBgsAi={false}
        />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("tab", { name: "Personal watchlist" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/system-watchlist/global?"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: "Global watchlist" }));
    await screen.findByText("Global system watchlist");
    await screen.findByText("Alpha");
    expect(
      screen.getByRole("tab", { name: "Global watchlist" }),
    ).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(
      await screen.findByRole("dialog", { name: "Filter global watchlist" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Government")).toHaveTextContent("Corporate");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Alpha to your personal watchlist",
      }),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === "/api/system-watchlist" && init?.method === "PUT",
        ),
      ).toBe(true),
    );
    const putCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/system-watchlist" && init?.method === "PUT",
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      systems: [
        { system: "Alpha", sector: "", projectName: "", favorite: false },
      ],
    });
    queryClient.clear();
  });

  it("loads protected factions lazily and filters to one faction", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SystemWatchlist
          tenantFactionName="East India Company"
          canManageTenantRules
          canRunBgsAi={false}
        />
      </QueryClientProvider>,
    );

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/system-watchlist/protected?"),
      ),
    ).toBe(false);

    fireEvent.click(
      screen.getByRole("tab", { name: "Protected factions watchlist" }),
    );
    await screen.findByRole("heading", {
      name: "Protected factions watchlist",
    });
    await screen.findByText("Guardian");
    expect(screen.getByLabelText("Protected faction")).toHaveValue("all");
    expect(screen.getByLabelText("Protected faction")).toHaveTextContent(
      "Aegis Shield",
    );
    expect(
      screen.getByLabelText("Aegis Shield is present in this system"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Open BGS AI intelligence for Guardian",
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Protected faction"), {
      target: { value: "7" },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("protected_faction_id=7"),
        ),
      ).toBe(true),
    );
    queryClient.clear();
  });

  it("shows BGS AI, conflict and state details and filters carrier facilities", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SystemWatchlist
          tenantFactionName="East India Company"
          canManageTenantRules={false}
          canRunBgsAi
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Global watchlist" }));
    await screen.findByText("Alpha");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open BGS AI intelligence for Alpha",
      }),
    );
    expect(
      await screen.findByRole("dialog", { name: "BGS AI intelligence" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close BGS AI intelligence" }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open record detail and influence history for Alpha",
      }),
    );
    const detail = await screen.findByRole("dialog", { name: "Record detail" });
    await within(detail).findByText("Alpha Gateway");
    expect(
      detail.querySelector(
        'img[data-kind="coriolis"][src="/station-icons/coriolis.svg"]',
      ),
    ).toBeInTheDocument();
    expect(
      detail.querySelector(".watch-detail-conflict-chip"),
    ).toHaveTextContent("Civil War");
    expect(
      within(detail).getByRole("columnheader", { name: "Active state" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("columnheader", { name: "Pending state" }),
    ).toBeInTheDocument();
    expect(within(detail).getByText("Boom")).toBeInTheDocument();
    expect(within(detail).getByText("Election")).toBeInTheDocument();
    expect(
      within(detail).getByRole("tab", { name: "Outposts 0" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("tab", {
        name: "Surface Ports/Outposts 0",
      }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("tab", { name: "Installations 0" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(detail).getByRole("tab", { name: "Fleet Carriers 1" }),
    );
    expect(
      within(detail).getByText("[VALK] Graf Zeppelin (G4K-N8L)"),
    ).toBeInTheDocument();
    expect(
      within(detail).getByText("Not published by Spansh"),
    ).toBeInTheDocument();
    expect(within(detail).queryByText("Alpha Gateway")).not.toBeInTheDocument();
    queryClient.clear();
  });
});

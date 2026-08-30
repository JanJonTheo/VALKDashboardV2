import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedFactionAdministration } from "@/components/protected-faction-administration";

const initialFactions = [
  {
    id: 7,
    name: "Aegis Shield",
    description: "Primary ally",
    protected: true,
    webhook_configured: true,
  },
  {
    id: 8,
    name: "Beacon Guard",
    description: "Reserve ally",
    protected: false,
    webhook_configured: false,
  },
];

function renderAdministration() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProtectedFactionAdministration />
    </QueryClientProvider>,
  );
}

describe("protected faction administration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/candidates?"))
            return Response.json({ data: [{ name: "East India Company" }] });
          if (url === "/api/admin/protected-factions" && !init?.method)
            return Response.json({ data: initialFactions });
          if (
            url === "/api/admin/protected-factions" &&
            init?.method === "POST"
          )
            return Response.json(
              {
                data: {
                  id: 9,
                  name: "East India Company",
                  description: "New ally",
                  protected: true,
                  webhook_configured: true,
                },
              },
              { status: 201 },
            );
          return Response.json({ ok: true, data: initialFactions[0] });
        },
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists, searches and filters active and inactive factions", async () => {
    renderAdministration();
    expect(await screen.findByText("Aegis Shield")).toBeInTheDocument();
    expect(screen.getByText("Beacon Guard")).toBeInTheDocument();
    expect(screen.getByText("Discord configured")).toBeInTheDocument();
    expect(screen.queryByText(/private_token/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search factions"), {
      target: { value: "reserve" },
    });
    expect(screen.queryByText("Aegis Shield")).not.toBeInTheDocument();
    expect(screen.getByText("Beacon Guard")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search factions"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Protection status"), {
      target: { value: "active" },
    });
    expect(screen.getByText("Aegis Shield")).toBeInTheDocument();
    expect(screen.queryByText("Beacon Guard")).not.toBeInTheDocument();
  });

  it("creates a faction with optional EDDN suggestions and a write-only webhook", async () => {
    renderAdministration();
    await screen.findByText("Aegis Shield");
    fireEvent.click(
      screen.getByRole("button", { name: "New protected faction" }),
    );

    const nameInput = screen.getByLabelText("Faction name");
    fireEvent.change(nameInput, {
      target: { value: "Eas" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "New ally" },
    });
    const webhookInput = screen.getByLabelText(
      "Discord webhook URL (optional)",
    );
    expect(webhookInput).toHaveAttribute("type", "url");
    fireEvent.change(webhookInput, {
      target: {
        value: "https://discord.com/api/webhooks/123/private_token",
      },
    });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/candidates?q=Eas"),
        expect.anything(),
      ),
    );
    const candidate = await screen.findByRole("option", {
      name: "East India Company",
    });
    expect(nameInput).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(candidate);
    expect(nameInput).toHaveValue("East India Company");
    expect(nameInput).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Create faction" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/protected-factions",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const request = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/admin/protected-factions" && init?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      name: "East India Company",
      description: "New ally",
      protected: true,
      webhook_url: "https://discord.com/api/webhooks/123/private_token",
    });
  });

  it("confirms deactivation and typed permanent deletion", async () => {
    renderAdministration();
    const row = (await screen.findByText("Aegis Shield")).closest("article")!;
    fireEvent.click(within(row).getByRole("button", { name: "Deactivate" }));
    const deactivateDialog = screen.getByRole("dialog", {
      name: "Deactivate protected faction",
    });
    fireEvent.click(
      within(deactivateDialog).getByRole("button", {
        name: "Deactivate faction",
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/protected-factions/7",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ protected: false }),
        }),
      ),
    );

    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    const deleteDialog = screen.getByRole("dialog", {
      name: "Delete protected faction",
    });
    const deleteButton = within(deleteDialog).getByRole("button", {
      name: "Delete permanently",
    });
    expect(deleteButton).toBeDisabled();
    fireEvent.change(
      within(deleteDialog).getByLabelText("Type Aegis Shield to confirm"),
      { target: { value: "Aegis Shield" } },
    );
    fireEvent.click(deleteButton);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/protected-factions/7",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("tests the stored webhook without exposing its URL", async () => {
    renderAdministration();
    const row = (await screen.findByText("Aegis Shield")).closest("article")!;
    fireEvent.click(within(row).getByRole("button", { name: "Test webhook" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/protected-factions/7/webhook-test",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByText("Discord test message delivered."),
    ).toBeInTheDocument();
  });
});

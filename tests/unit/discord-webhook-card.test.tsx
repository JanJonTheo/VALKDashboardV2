import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordWebhookCard } from "@/components/discord-webhook-card";

describe("personal Discord webhook", () => {
  const fetchMock = vi.fn();
  let storedWebhook: string | null;

  beforeEach(() => {
    storedWebhook =
      "https://discord.com/api/webhooks/123456/current_personal_token";
    fetchMock
      .mockReset()
      .mockImplementation(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const endpoint = String(input);
          if (endpoint.endsWith("/test") && init?.method === "POST")
            return Response.json({ ok: true });
          if (init?.method === "PUT") {
            storedWebhook = JSON.parse(String(init.body)).webhook_url;
            return Response.json({ ok: true });
          }
          if (init?.method === "DELETE") {
            storedWebhook = null;
            return Response.json({ ok: true });
          }
          return Response.json({
            configured: storedWebhook !== null,
            webhook_url: storedWebhook,
            updated_at: storedWebhook ? "2026-09-02T10:00:00Z" : null,
            encryption_configured: true,
          });
        },
      );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderCard() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <DiscordWebhookCard />
      </QueryClientProvider>,
    );
    return client;
  }

  it("shows the saved URL in clear text and keeps the updated URL visible", async () => {
    const client = renderCard();
    const input = await screen.findByRole("textbox", {
      name: "Discord webhook URL",
    });
    expect(input).toHaveAttribute("type", "url");
    await waitFor(() => expect(input).toHaveValue(storedWebhook));
    expect(
      await screen.findByText(/URL is encrypted at rest/),
    ).toBeInTheDocument();

    const replacement =
      "https://discord.com/api/webhooks/987654/replacement_token";
    fireEvent.change(input, { target: { value: replacement } });
    fireEvent.click(screen.getByRole("button", { name: "Save webhook" }));

    await screen.findByText("Webhook saved securely.");
    await waitFor(() => expect(input).toHaveValue(replacement));
    expect(
      fetchMock.mock.calls.some(
        ([request, init]) =>
          String(request) === "/api/account/discord-webhook" &&
          init?.method === "PUT" &&
          JSON.parse(String(init.body)).webhook_url === replacement,
      ),
    ).toBe(true);
    client.clear();
  });

  it("tests and removes the stored webhook", async () => {
    const client = renderCard();
    await screen.findByDisplayValue(storedWebhook as string);

    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    await screen.findByText("Test message delivered.");
    expect(
      fetchMock.mock.calls.some(
        ([request, init]) =>
          String(request).endsWith("/test") && init?.method === "POST",
      ),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await screen.findByText("Webhook removed.");
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Discord webhook URL" }),
      ).toHaveValue(""),
    );
    client.clear();
  });
});

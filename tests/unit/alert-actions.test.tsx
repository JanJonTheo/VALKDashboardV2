import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AlertDiscordButton } from "@/components/alert-discord-button";
import type { BgsAlert } from "@/lib/bgs-rules";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("reuses the request ID after an uncertain network failure", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: "pending" } }),
    });
  vi.stubGlobal("fetch", fetcher);
  const alert = {
    id: "test",
    discord: {
      configured: true,
      status: null,
      last_sent_at: null,
      error: null,
    },
  } as BgsAlert;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AlertDiscordButton alert={alert} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Send to Discord" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Send to Discord" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it("disables delivery when the channel is missing or a send is pending", () => {
  const alert = {
    id: "test",
    discord: {
      configured: false,
      status: null,
      last_sent_at: null,
      error: null,
    },
  } as BgsAlert;
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <AlertDiscordButton alert={alert} />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button")).toBeDisabled();
  result.rerender(
    <QueryClientProvider client={client}>
      <AlertDiscordButton
        alert={{
          ...alert,
          discord: { ...alert.discord!, configured: true, status: "pending" },
        }}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button")).toBeDisabled();
});

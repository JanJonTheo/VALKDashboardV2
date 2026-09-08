import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SystemLabelsEditor,
  SystemLinksMenu,
} from "@/components/watchlist-system-actions";
import { systemExternalLinks } from "@/lib/watchlist-labels";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const labels = {
  system: "Preae Aihm DN-I c23-44",
  sector: "West",
  projectName: "Harbor",
};
function editor(
  shared: boolean,
  onSave?: (value: typeof labels) => Promise<unknown>,
) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SystemLabelsEditor labels={labels} shared={shared} onSave={onSave} />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Edit sector and project/ }),
  );
}

describe("watchlist system actions", () => {
  it("edits and clears personal labels without changing shared labels", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    editor(false, save);
    expect(screen.getByLabelText("Sector")).toHaveValue("West");
    fireEvent.change(screen.getByLabelText("Sector"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Relay" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save labels" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        ...labels,
        sector: "",
        projectName: "Relay",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
  it("retains shared edits on save failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { message: "Try again" } }, { status: 502 }),
        ),
    );
    editor(true);
    fireEvent.change(screen.getByLabelText("Sector"), {
      target: { value: "East" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save labels" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
    expect(screen.getByLabelText("Sector")).toHaveValue("East");
  });
  it("provides three system-specific links in an accessible dropdown", async () => {
    render(<SystemLinksMenu system={labels.system} />);
    fireEvent.keyDown(screen.getByRole("button", { name: /External links/ }), {
      key: "ArrowDown",
    });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Raven Colonial",
      "Inara",
      "Spansh",
    ]);
    systemExternalLinks(labels.system).forEach((link, index) => {
      expect(items[index]).toHaveAttribute("href", link.href);
      expect(items[index]).toHaveAttribute("target", "_blank");
    });
    expect(systemExternalLinks("A&B / C")[0].href).toContain("A%26B%20%2F%20C");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyTextButton } from "@/components/copy-text-button";

describe("CopyTextButton", () => {
  it("copies the supplied system name and exposes confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <CopyTextButton value="Synuefe GL-C b46-3" label="Copy system name" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /copy system name/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Synuefe GL-C b46-3"),
    );
    expect(screen.getByTitle("Copied")).toBeInTheDocument();
  });
});

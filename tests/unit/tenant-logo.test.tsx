import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TenantLogo } from "@/components/tenant-logo";

afterEach(cleanup);

it("loads the authenticated tenant image directly and eagerly", () => {
  render(
    <TenantLogo
      tenant={{
        id: "eic",
        name: "East India Company",
        logoUrl: "/api/tenant-logo?tenant=eic",
      }}
    />,
  );
  const image = screen.getByRole("img", { name: "East India Company logo" });
  expect(image.getAttribute("src")).toMatch(/\/api\/tenant-logo\?tenant=eic$/);
  expect(image).toHaveAttribute("loading", "eager");
});

it("shows initials on failure and loads the next tenant independently", () => {
  const view = render(
    <TenantLogo
      tenant={{
        id: "eic",
        name: "East India Company",
        logoUrl: "/api/tenant-logo?tenant=eic",
      }}
    />,
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img")).toHaveTextContent("EIC");
  view.rerender(
    <TenantLogo
      tenant={{
        id: "valk",
        name: "VALK Development",
        logoUrl: "/api/tenant-logo?tenant=valk",
      }}
    />,
  );
  expect(
    screen.getByRole("img", { name: "VALK Development logo" }),
  ).toHaveAttribute("src", expect.stringMatching(/\/api\/tenant-logo\?tenant=valk$/));
});

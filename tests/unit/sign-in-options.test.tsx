import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInOptions } from "@/components/sign-in-options";

const replace = vi.fn();
const refresh = vi.fn();
const social = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signIn: { social } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  replace.mockReset();
  refresh.mockReset();
  social.mockReset();
  document.cookie = "valk_login_tenant=; Max-Age=0; Path=/";
});

describe("SignInOptions", () => {
  it("uses one tenant selector and never asks the browser for an API key", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(
      <SignInOptions
        tenants={[
          { id: "east-india-company", name: "East India Company" },
          { id: "valk-development", name: "VALK Development" },
        ]}
        defaultTenantId="valk-development"
        discordEnabled
      />,
    );

    expect(screen.getByLabelText("Tenant")).toHaveValue("valk-development");
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "jjt" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });

    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Login with Discord" }),
    ).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Login with Credentials" }),
    );

    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    const [, options] = request.mock.calls[0];
    const payload = JSON.parse(String(options?.body)) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({
      tenantId: "valk-development",
      username: "jjt",
      password: "secret",
    });
    expect(payload).not.toHaveProperty("apiKey");
  });

  it("starts Discord sign-in for the tenant selected in the shared selector", async () => {
    social.mockResolvedValue({ error: null });
    render(
      <SignInOptions
        tenants={[
          { id: "east-india-company", name: "East India Company" },
          { id: "valk-development", name: "VALK Development" },
        ]}
        defaultTenantId="valk-development"
        discordEnabled
      />,
    );

    fireEvent.change(screen.getByLabelText("Tenant"), {
      target: { value: "east-india-company" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Login with Discord" }));

    await waitFor(() =>
      expect(social).toHaveBeenCalledWith({
        provider: "discord",
        callbackURL: new URL(
          "/api/session/social-complete?tenantId=east-india-company",
          window.location.origin,
        ).toString(),
      }),
    );
    expect(document.cookie).toContain("valk_login_tenant=east-india-company");
  });
});

import { expect, test } from "@playwright/test";

test("remote screen lists devices without joining and produces a pairing code", async ({ page }) => {
  let joins = 0;
  await page.route("**/api/remote-screen/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/devices")) {
      await route.fulfill({ json: { devices: [{ id: "a".repeat(32), name: "Test Elite", online: true,
        owner: true, grants: {}, can_control: true, status: { commander: "Test Commander", assist: "Waypoint Assist", control_enabled: false } }] } });
    } else if (url.pathname.endsWith("/pairings")) {
      await route.fulfill({ json: { code: "one-time-pairing-code", expires_in: 600 } });
    } else if (url.pathname.endsWith("/share-candidates")) {
      await route.fulfill({ json: { users: url.searchParams.get("q") === "Friend" ? [{ id: "2", name: "Friend Commander" }] : [] } });
    } else if (url.pathname.endsWith("/grants")) {
      expect(route.request().postDataJSON()).toEqual({ user_id: "2", rights: ["view", "control"] });
      await route.fulfill({ json: { ok: true } });
    } else { joins++; await route.fulfill({ status: 503, json: { error: { message: "Media unavailable" } } }); }
  });
  await page.goto("/operations/anke-remote");
  await expect(page.getByRole("heading", { name: "ANKe Remote", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test Elite", exact: true })).toBeVisible();
  await expect(page.getByText("Control disabled locally")).toBeVisible();
  expect(joins).toBe(0);
  await page.getByRole("button", { name: "Pair an ANKe client" }).click();
  await expect(page.getByText("one-time-pairing-code")).toBeVisible();
  await page.getByRole("button", { name: "Open screen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Media unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop all assists / zero throttle" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Find a user" }).fill("Friend");
  await expect(page.getByRole("option", { name: "Friend Commander" })).toBeAttached();
  await page.getByRole("combobox", { name: "User to share with" }).selectOption("2");
  await page.getByRole("combobox", { name: "Access rights" }).selectOption("control");
  await page.getByRole("button", { name: "Grant access" }).click();
  await page.getByRole("button", { name: "Close screen" }).click();
});

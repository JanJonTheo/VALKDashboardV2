// @vitest-environment node
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ paths: new Map<string, string>() }));
vi.mock("@/lib/tenant-config", () => ({
  getTenantById: async (id: string) => ({ databasePath: mocks.paths.get(id) }),
}));
import {
  loadWatchlistLabels,
  saveWatchlistLabels,
} from "@/lib/watchlist-labels-store";

describe("tenant watchlist labels", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "valk-labels-"));
    for (const id of ["one", "two"]) {
      const path = join(root, `${id}.db`);
      new Database(path).close();
      mocks.paths.set(id, path);
    }
  });
  afterEach(() => {
    if (!root.startsWith(join(tmpdir(), "valk-labels-")))
      throw new Error("Unexpected test directory");
    rmSync(root, { recursive: true, force: true });
    mocks.paths.clear();
  });
  it("starts empty, persists edits independently and isolates tenants", async () => {
    expect((await loadWatchlistLabels("one")).size).toBe(0);
    await saveWatchlistLabels("one", "2", {
      system: "Alpha",
      sector: "West",
      projectName: "Harbor",
    });
    await saveWatchlistLabels("one", "3", {
      system: "Beta",
      sector: "East",
      projectName: "Relay",
    });
    await saveWatchlistLabels("one", "2", {
      system: "ALPHA",
      sector: "",
      projectName: "New",
    });
    const labels = await loadWatchlistLabels("one");
    expect(labels.size).toBe(2);
    expect(labels.get("alpha")).toMatchObject({
      sector: "",
      projectName: "New",
    });
    expect(labels.get("beta")).toMatchObject({
      sector: "East",
      projectName: "Relay",
    });
    expect((await loadWatchlistLabels("two")).size).toBe(0);
  });
});

import "server-only";
import Database from "better-sqlite3";
import { getTenantById } from "@/lib/tenant-config";
import type { WatchlistLabels } from "@/lib/watchlist-labels";

async function databasePath(tenantId: string) {
  const tenant = await getTenantById(tenantId);
  if (!tenant?.databasePath)
    throw new Error("The tenant database is unavailable");
  return tenant.databasePath;
}

export async function loadWatchlistLabels(
  tenantId: string,
): Promise<Map<string, WatchlistLabels>> {
  const database = new Database(await databasePath(tenantId), {
    readonly: true,
  });
  try {
    database.pragma("busy_timeout = 5000");
    if (
      !database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='table' AND name='dashboard_watchlist_system_label'",
        )
        .get()
    )
      return new Map();
    const rows = database
      .prepare(
        "SELECT system_key, system_name AS system, sector, project_name AS projectName FROM dashboard_watchlist_system_label",
      )
      .all() as (WatchlistLabels & { system_key: string })[];
    return new Map(rows.map((row) => [row.system_key, row]));
  } finally {
    database.close();
  }
}

export async function saveWatchlistLabels(
  tenantId: string,
  userId: string,
  labels: WatchlistLabels,
) {
  const database = new Database(await databasePath(tenantId), {
    fileMustExist: true,
  });
  try {
    database.pragma("busy_timeout = 5000");
    database.exec(`CREATE TABLE IF NOT EXISTS dashboard_watchlist_system_label (
      system_key TEXT PRIMARY KEY, system_name TEXT NOT NULL,
      sector TEXT NOT NULL DEFAULT '', project_name TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    database
      .prepare(
        `INSERT INTO dashboard_watchlist_system_label
      (system_key,system_name,sector,project_name,updated_by,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(system_key) DO UPDATE SET system_name=excluded.system_name,
      sector=excluded.sector,project_name=excluded.project_name,
      updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      )
      .run(
        labels.system.toLocaleLowerCase("en"),
        labels.system,
        labels.sector,
        labels.projectName,
        userId,
        new Date().toISOString(),
      );
  } finally {
    database.close();
  }
}

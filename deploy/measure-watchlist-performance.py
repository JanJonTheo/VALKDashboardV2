"""Compare watchlist history query plans without modifying either database.

Uses the largest saved personal watchlist (up to 100 systems). Result rows and
system names are not printed. INDEXED BY only selects an existing index.
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
import time


def readonly(path):
    connection = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=1)
    connection.execute("PRAGMA query_only=ON")
    return connection


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tenant-database", required=True)
    parser.add_argument("--snapshot-database", required=True)
    args = parser.parse_args()
    tenant = readonly(args.tenant_database)
    try:
        preferences = [json.loads(row[0]) for row in tenant.execute(
            "SELECT payload_json FROM dashboard_view_preference WHERE view_key='bgs-system-watchlist'"
        )]
    finally:
        tenant.close()
    systems = max((
        [entry["system"] for entry in preference.get("systems", []) if isinstance(entry, dict) and entry.get("system")]
        for preference in preferences
    ), key=len, default=[])[:100]
    if not systems:
        raise SystemExit("No saved watchlist to measure")
    conn = readonly(args.snapshot_database)
    report = {"measured_at": datetime.now(timezone.utc).isoformat(), "requested_systems": len(systems), "measurements": []}
    marks = ",".join("?" for _ in systems)
    parameters = systems + [(datetime.now(timezone.utc) - timedelta(days=8)).strftime("%Y-%m-%dT%H:%M:%S.000Z")]
    baseline = None
    try:
        # Hold one read snapshot so concurrent ingestion cannot change equality.
        conn.execute("BEGIN")
        report["statistics_present"] = bool(conn.execute("SELECT 1 FROM sqlite_master WHERE name='sqlite_stat1'").fetchone())
        for label, hint in [("current_plan", ""), ("existing_system_tick_index", "INDEXED BY ix_snapshot_system_ticktime")]:
            sql = f"SELECT system_name,ticktime,payload_json FROM system_tick_snapshot {hint} WHERE system_name IN ({marks}) AND ticktime >= ? AND is_settled=1 ORDER BY system_name COLLATE NOCASE,ticktime"
            result = {"query": label, "plan": [row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + sql, parameters)]}
            started = time.perf_counter()
            conn.set_progress_handler(lambda: time.perf_counter() - started > 8, 1000)
            try:
                rows = conn.execute(sql, parameters).fetchall()
                result["returned_rows"] = len(rows)
                if label == "current_plan":
                    baseline = rows
                elif baseline is not None:
                    result["matches_baseline"] = rows == baseline
            except sqlite3.OperationalError as error:
                result["error"] = str(error)
            finally:
                result["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
                conn.set_progress_handler(None, 0)
                report["measurements"].append(result)
    finally:
        conn.close()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

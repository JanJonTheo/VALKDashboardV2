"""Bounded production-read-only diagnostics; does not start the Flask app.

The optional index comparison writes only to a disposable in-memory backup.

Outputs query plans, row counts and durations, never result rows or credentials.
Example: python3 measure-api-performance.py --database /home/valk/db/bgs_data_valk.db
"""

import argparse
import datetime
import json
from pathlib import Path
import sqlite3
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--app", default="/home/valk/valk/app.py")
    parser.add_argument("--tenant-file", default="/home/valk/valk/tenant.json")
    parser.add_argument("--tenant", default="VALK Development")
    parser.add_argument("--seconds", type=float, default=3)
    parser.add_argument("--compare-indexes", action="store_true", help="Test indexes only in a disposable in-memory backup")
    parser.add_argument("--http", action="store_true", help="Time three sequential read-only requests to the local Flask API")
    args = parser.parse_args()
    if not 0 < args.seconds <= 10:
        parser.error("--seconds must be greater than zero and at most ten")
    configured = json.loads(Path(args.tenant_file).read_text())
    tenants = configured if isinstance(configured, list) else configured.get("tenants", list(configured.values()))
    tenant = next(item for item in tenants if item.get("name") == args.tenant)
    path = Path(args.database).resolve()
    conn = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=1)
    conn.execute("PRAGMA query_only=ON")
    report = {
        "measured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tenant": args.tenant,
        "database_bytes": path.stat().st_size,
        "per_statement_budget_seconds": args.seconds,
        "measurements": [],
    }
    reference_results = {}

    def measure(label, sql, parameters=None):
        parameters = parameters or {}
        started = time.perf_counter()
        conn.set_progress_handler(lambda: time.perf_counter() - started > args.seconds, 1000)
        result = {"query": label}
        try:
            result["plan"] = [row[3] for row in conn.execute("EXPLAIN QUERY PLAN " + sql, parameters)]
            rows = conn.execute(sql, parameters).fetchall()
            result["returned_rows"] = len(rows)
            if label.startswith("leaderboard_"):
                if label.endswith("_indexed"):
                    baseline = reference_results.get(label.removesuffix("_indexed"))
                    result["matches_baseline"] = rows == baseline if baseline is not None else None
                else:
                    reference_results[label] = rows
            if label.endswith("_count"):
                result["count"] = rows[0][0]
        except sqlite3.OperationalError as error:
            result["error"] = str(error)
        finally:
            result["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
            conn.set_progress_handler(None, 0)
            report["measurements"].append(result)

    try:
        report["indexes"] = [
            {"table": row[0], "name": row[1], "sql": row[2]}
            for row in conn.execute(
                "SELECT tbl_name, name, sql FROM sqlite_master WHERE type='index' "
                "AND tbl_name IN ('event','mission_completed_event','mission_completed_influence',"
                "'dashboard_bgs_alert','dashboard_notification_delivery')"
            )
        ]
        measure("event_count", "SELECT COUNT(*) FROM event")
        measure("explorer_first_page", "SELECT * FROM event ORDER BY timestamp DESC LIMIT 250")
        measure("explorer_late_page", "SELECT * FROM event ORDER BY timestamp DESC LIMIT 250 OFFSET 25000")
        for column in ["cmdr", "event", "tickid"]:
            measure("catalog_distinct_" + column, f'SELECT DISTINCT "{column}" FROM event WHERE "{column}" IS NOT NULL ORDER BY "{column}"')
        source = Path(args.app).read_text()
        section = source.split("def build_leaderboard_data(", 1)[1]
        sql = section.split('sql = f"""', 1)[1].split('"""', 1)[0]
        parameters = {"faction_name_like": "%" + tenant["faction_name"] + "%"}
        tick = conn.execute("SELECT tickid FROM event WHERE tickid IS NOT NULL ORDER BY timestamp DESC LIMIT 1").fetchone()
        if tick:
            measure("leaderboard_current_tick", sql.replace("{date_filter_sub}", "ex.tickid = :tickid").replace("{date_filter}", "e.tickid = :tickid"), {**parameters, "tickid": tick[0]})
        measure("leaderboard_all", sql.replace("{date_filter_sub}", "1=1").replace("{date_filter}", "1=1"), parameters)
        measure("alert_count", "SELECT COUNT(*) FROM dashboard_bgs_alert")
        measure("delivery_count", "SELECT COUNT(*) FROM dashboard_notification_delivery")
        measure("alert_delivery_lookup", "SELECT status, delivered_at, last_error FROM dashboard_notification_delivery WHERE alert_id=(SELECT id FROM dashboard_bgs_alert ORDER BY fired_at DESC LIMIT 1) AND channel='tenant_discord' ORDER BY CASE WHEN status IN ('pending','processing','retry') THEN 0 ELSE 1 END, created_at DESC")
        if args.compare_indexes:
            original = conn
            conn = sqlite3.connect(":memory:")
            try:
                original.backup(conn, pages=256, sleep=0.02)
            finally:
                original.close()
            # Compare on the same snapshot/storage, not disk versus memory.
            if tick:
                measure("leaderboard_current_tick_memory", sql.replace("{date_filter_sub}", "ex.tickid = :tickid").replace("{date_filter}", "e.tickid = :tickid"), {**parameters, "tickid": tick[0]})
            measure("leaderboard_all_memory", sql.replace("{date_filter_sub}", "1=1").replace("{date_filter}", "1=1"), parameters)
            # These writes affect only the disposable in-memory backup.
            report["candidate_indexes"] = [
                "CREATE INDEX perf_market_buy_event_id ON market_buy_event(event_id)",
                "CREATE INDEX perf_market_sell_event_id ON market_sell_event(event_id)",
                "CREATE INDEX perf_mission_completed_event_id ON mission_completed_event(event_id)",
                "CREATE INDEX perf_mission_failed_event_id ON mission_failed_event(event_id)",
                "CREATE INDEX perf_commit_crime_event_id ON commit_crime_event(event_id)",
                "CREATE INDEX perf_event_cmdr_tickid ON event(cmdr, tickid)",
            ]
            for statement in report["candidate_indexes"]:
                conn.execute(statement)
            conn.execute("PRAGMA query_only=ON")
            if tick:
                measure("leaderboard_current_tick_memory_indexed", sql.replace("{date_filter_sub}", "ex.tickid = :tickid").replace("{date_filter}", "e.tickid = :tickid"), {**parameters, "tickid": tick[0]})
            measure("leaderboard_all_memory_indexed", sql.replace("{date_filter_sub}", "1=1").replace("{date_filter}", "1=1"), parameters)
    finally:
        conn.close()
    if args.http:
        report["http"] = []
        # Fixed read-only endpoints, sequential requests, no load test.
        for endpoint in ["summary/leaderboard?period=ct", "summary/leaderboard?period=all", "table/event?page=1&page_size=250&sort=timestamp&direction=desc"]:
            request = urllib.request.Request("http://127.0.0.1:5000/api/" + endpoint, headers={"apikey": tenant["api_key"], "apiversion": str(tenant.get("api_version", "1.8.0"))})
            started = time.perf_counter()
            result = {"endpoint": endpoint}
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    result["status"] = response.status
                    result["bytes"] = len(response.read())
            except Exception as error:
                result["error_type"] = type(error).__name__
            result["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
            report["http"].append(result)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

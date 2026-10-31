"""Merge CSV labels and missing personal systems without replacing existing entries.

Dry-run by default. --apply requires a new --backup JSON path for affected rows.
"""

from __future__ import annotations

import argparse
import json
import runpy
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

load_entries = runpy.run_path(str(Path(__file__).with_name("seed-system-watchlist.py")))["load_entries"]


def merge(connection, username, entries, backup=None):
    connection.row_factory = sqlite3.Row
    connection.execute("BEGIN IMMEDIATE")
    try:
        user = connection.execute(
            "SELECT id FROM users WHERE username=? COLLATE NOCASE", (username,)
        ).fetchone()
        if not user:
            raise ValueError("Requested user does not exist")
        preference = connection.execute(
            "SELECT * FROM dashboard_view_preference WHERE user_id=? AND view_key=?",
            (user["id"], "bgs-system-watchlist"),
        ).fetchone()
        payload = json.loads(preference["payload_json"]) if preference else {"systems": []}
        systems = payload["systems"]
        existing = {entry["system"].casefold(): entry for entry in systems}
        if len(existing) != len(systems):
            raise ValueError("Existing watchlist contains duplicates")
        added = 0
        for entry in entries:
            key = entry["system"].casefold()
            if key in existing:
                existing[key].update(sector=entry["sector"], projectName=entry["projectName"])
            else:
                systems.append(dict(entry))
                existing[key] = systems[-1]
                added += 1
        if len(systems) > 200:
            raise ValueError("Merged watchlist exceeds 200 systems")
        summary = {"mapped": len(entries), "added": added, "total": len(systems)}
        if backup is None:
            connection.rollback()
            return summary
        has_labels = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='dashboard_watchlist_system_label'"
        ).fetchone()
        old_labels = []
        if has_labels:
            for entry in entries:
                row = connection.execute(
                    "SELECT * FROM dashboard_watchlist_system_label WHERE system_key=?",
                    (entry["system"].lower(),),
                ).fetchone()
                if row:
                    old_labels.append(dict(row))
        with Path(backup).open("x", encoding="utf-8") as handle:
            json.dump({"preference": dict(preference) if preference else None,
                       "labels": old_labels, "systems": [e["system"] for e in entries]}, handle, indent=2)
        connection.execute("""CREATE TABLE IF NOT EXISTS dashboard_watchlist_system_label (
            system_key TEXT PRIMARY KEY, system_name TEXT NOT NULL,
            sector TEXT NOT NULL DEFAULT '', project_name TEXT NOT NULL DEFAULT '',
            updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)""")
        now = datetime.now(timezone.utc).isoformat()
        for entry in entries:
            connection.execute("""INSERT INTO dashboard_watchlist_system_label
                (system_key,system_name,sector,project_name,updated_by,updated_at) VALUES (?,?,?,?,?,?)
                ON CONFLICT(system_key) DO UPDATE SET system_name=excluded.system_name,
                sector=excluded.sector,project_name=excluded.project_name,
                updated_by=excluded.updated_by,updated_at=excluded.updated_at""",
                (entry["system"].lower(), entry["system"], entry["sector"], entry["projectName"], user["id"], now))
        connection.execute("""INSERT INTO dashboard_view_preference
            (id,user_id,view_key,schema_version,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(user_id,view_key) DO UPDATE SET schema_version=excluded.schema_version,
            payload_json=excluded.payload_json,updated_at=excluded.updated_at""",
            (str(uuid.uuid4()), user["id"], "bgs-system-watchlist", 2,
             json.dumps(payload, separators=(",", ":")), now, now))
        connection.commit()
        return summary
    except BaseException:
        connection.rollback()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--username", required=True)
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    if args.apply and not args.backup:
        parser.error("--apply requires --backup")
    database = args.database.resolve(strict=True)
    with sqlite3.connect(f"{database.as_uri()}?mode=rw", uri=True, timeout=30) as connection:
        print(json.dumps(merge(connection, args.username, load_entries(args.csv), args.backup if args.apply else None)))

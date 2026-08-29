"""Seed one tenant user's personal BGS system watchlist from a CSV export."""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path


def load_entries(path: Path) -> list[dict[str, str | bool]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = csv.DictReader(handle)
        if not rows.fieldnames:
            raise RuntimeError("The CSV file has no header row")
        system_column = next(
            (name for name in ("System", "System Name") if name in rows.fieldnames),
            None,
        )
        required = {"Sector", "Project Name"}
        if not system_column or not required.issubset(rows.fieldnames):
            raise RuntimeError(
                "The CSV must contain Sector, Project Name and System/System Name"
            )
        result: list[dict[str, str]] = []
        seen: set[str] = set()
        for row in rows:
            system = (row.get(system_column) or "").strip()
            if not system:
                continue
            key = system.casefold()
            if key in seen:
                raise RuntimeError(f"Duplicate system in CSV: {system}")
            seen.add(key)
            result.append(
                {
                    "system": system,
                    "sector": (row.get("Sector") or "").strip(),
                    "projectName": (row.get("Project Name") or "").strip(),
                    "favorite": False,
                }
            )
    if not result:
        raise RuntimeError("The CSV contains no systems")
    if len(result) > 100:
        raise RuntimeError("A watchlist supports at most 100 systems")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--csv", required=True)
    args = parser.parse_args()

    database = Path(args.database).resolve(strict=True)
    source = Path(args.csv).resolve(strict=True)
    entries = load_entries(source)
    now = datetime.now(timezone.utc).isoformat()
    connection = sqlite3.connect(database, timeout=30)
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=30000")
        user = connection.execute(
            "SELECT id FROM users WHERE username = ? COLLATE NOCASE",
            (args.username,),
        ).fetchone()
        if not user:
            raise RuntimeError("The requested tenant user does not exist")
        payload = json.dumps(
            {"systems": entries}, separators=(",", ":"), ensure_ascii=False
        )
        connection.execute(
            "INSERT INTO dashboard_view_preference"
            "(id,user_id,view_key,schema_version,payload_json,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?) "
            "ON CONFLICT(user_id,view_key) DO UPDATE SET "
            "schema_version=excluded.schema_version, "
            "payload_json=excluded.payload_json, updated_at=excluded.updated_at",
            (
                str(uuid.uuid4()),
                user[0],
                "bgs-system-watchlist",
                2,
                payload,
                now,
                now,
            ),
        )
        connection.commit()
    finally:
        connection.close()
    print(f"Seeded {len(entries)} unique systems for {args.username}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

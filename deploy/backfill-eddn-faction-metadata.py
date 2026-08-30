#!/usr/bin/env python3
"""Persist and backfill minor-faction government and allegiance metadata.

The current EDDN database retains raw journal messages for only 24 hours.  This
script copies the stable faction metadata out of those messages into the
``eddn_faction`` rows.  For tenant systems whose factions no longer occur in a
retained message it can use Spansh's compact system endpoint as a one-time
fallback.
"""

from __future__ import annotations

import argparse
import ast
import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable
from pathlib import Path
from typing import Any


USER_AGENT = "VALKDashboardV2/0.1 faction-metadata-backfill"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--snapshot-database", type=Path)
    parser.add_argument(
        "--tenant-faction",
        action="append",
        default=[],
        help="Tenant faction whose systems should receive the Spansh fallback",
    )
    parser.add_argument("--spansh-fallback", action="store_true")
    parser.add_argument(
        "--max-spansh-requests",
        type=int,
        default=0,
        help="Zero means no explicit request limit",
    )
    return parser.parse_args()


def parse_jsonish(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        parsed = json.loads(value)
    except Exception:
        try:
            parsed = ast.literal_eval(value)
        except Exception:
            return {}
    return parsed if isinstance(parsed, dict) else {}


def clean(value: Any) -> str:
    return str(value or "").strip()


def metadata_from_factions(
    factions: Any,
) -> dict[str, tuple[str, str, str]]:
    result: dict[str, tuple[str, str, str]] = {}
    if not isinstance(factions, list):
        return result
    for faction in factions:
        if not isinstance(faction, dict):
            continue
        name = clean(faction.get("Name") or faction.get("name"))
        if not name:
            continue
        government = clean(
            faction.get("Government_Localised")
            or faction.get("Government")
            or faction.get("government")
        )
        allegiance = clean(faction.get("Allegiance") or faction.get("allegiance"))
        if government or allegiance:
            result[name.casefold()] = (name, government, allegiance)
    return result


def ensure_columns(connection: sqlite3.Connection) -> None:
    columns = {
        row[1] for row in connection.execute("PRAGMA table_info(eddn_faction)")
    }
    if "government" not in columns:
        connection.execute("ALTER TABLE eddn_faction ADD COLUMN government VARCHAR(128)")
    if "allegiance" not in columns:
        connection.execute("ALTER TABLE eddn_faction ADD COLUMN allegiance VARCHAR(128)")
    connection.commit()


def retained_message_metadata(
    connection: sqlite3.Connection,
    wanted_names: set[str] | None = None,
) -> dict[str, tuple[str, str, str]]:
    metadata: dict[str, tuple[str, str, str]] = {}
    wanted_keys = {name.casefold() for name in wanted_names or set()}
    seen_message_ids: set[str] = set()
    batches = chunks(sorted(wanted_names)) if wanted_names else [None]
    for batch in batches:
        if batch:
            placeholders = ",".join("?" for _ in batch)
            rows = connection.execute(
                "SELECT DISTINCT m.id, m.message_json "
                "FROM eddn_message m JOIN eddn_faction f "
                "ON f.eddn_message_id=m.id "
                f"WHERE f.name IN ({placeholders})",
                batch,
            )
        else:
            rows = connection.execute("SELECT id, message_json FROM eddn_message")
        for message_id, message_json in rows:
            if message_id in seen_message_ids:
                continue
            seen_message_ids.add(message_id)
            payload = parse_jsonish(message_json)
            message = payload.get("message")
            if not isinstance(message, dict):
                continue
            found = metadata_from_factions(message.get("Factions"))
            if wanted_keys:
                found = {key: value for key, value in found.items() if key in wanted_keys}
            metadata.update(found)
    return metadata


def apply_metadata(
    connection: sqlite3.Connection,
    metadata: Iterable[tuple[str, str, str]],
) -> tuple[int, int]:
    factions = 0
    changed_rows = 0
    for name, government, allegiance in metadata:
        if not government and not allegiance:
            continue
        update_sql = (
            "UPDATE eddn_faction SET "
            "government=CASE WHEN government IS NULL OR trim(government)='' "
            "THEN ? ELSE government END, "
            "allegiance=CASE WHEN allegiance IS NULL OR trim(allegiance)='' "
            "THEN ? ELSE allegiance END "
            "WHERE {name_match} AND ("
            "government IS NULL OR trim(government)='' OR "
            "allegiance IS NULL OR trim(allegiance)='')"
        )
        cursor = connection.execute(
            update_sql.format(name_match="name=? COLLATE NOCASE"),
            (government, allegiance, name),
        )
        # A few historic EDDN faction names contain trailing whitespace while
        # Spansh exposes the canonical trimmed spelling. Keep the indexed exact
        # update fast and only scan for a trimmed match when it found no row.
        if cursor.rowcount == 0:
            cursor = connection.execute(
                update_sql.format(name_match="trim(name)=? COLLATE NOCASE"),
                (government, allegiance, name.strip()),
            )
        factions += 1
        changed_rows += max(0, cursor.rowcount)
    connection.commit()
    return factions, changed_rows


def chunks(values: list[str], size: int = 500) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def tenant_faction_names(
    connection: sqlite3.Connection,
    tenant_factions: list[str],
) -> set[str] | None:
    if not tenant_factions:
        return None
    placeholders = ",".join("?" for _ in tenant_factions)
    rows = connection.execute(
        "SELECT DISTINCT f.name FROM eddn_faction f "
        "WHERE f.system_name IN ("
        "SELECT DISTINCT system_name FROM eddn_faction "
        f"WHERE name IN ({placeholders})) AND f.name IS NOT NULL",
        tenant_factions,
    )
    return {clean(row[0]) for row in rows if clean(row[0])}


def snapshot_addresses(path: Path | None, systems: set[str]) -> dict[str, str]:
    if not path or not path.exists() or not systems:
        return {}
    connection = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    try:
        result: dict[str, str] = {}
        ordered_systems = sorted(systems)
        for batch in chunks(ordered_systems):
            placeholders = ",".join("?" for _ in batch)
            rows = connection.execute(
                "SELECT system_name, system_address FROM system_tick_snapshot "
                f"WHERE system_name IN ({placeholders}) "
                "AND system_address IS NOT NULL "
                "ORDER BY ticktime DESC",
                batch,
            )
            for system_name, address in rows:
                result.setdefault(str(system_name).casefold(), clean(address))
        return result
    finally:
        connection.close()


def request_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("Remote endpoint returned a non-object payload")
    return payload


def resolve_id64(system: str, cached: dict[str, str]) -> str:
    key = system.casefold()
    if cached.get(key):
        return cached[key]
    query = urllib.parse.quote(system, safe="")
    payload = request_json(f"https://spansh.co.uk/api/search/systems?q={query}")
    for item in payload.get("results", []):
        if not isinstance(item, dict):
            continue
        if clean(item.get("name")).casefold() == key and item.get("id64"):
            cached[key] = clean(item["id64"])
            return cached[key]
    return ""


def tenant_missing_coverage(
    connection: sqlite3.Connection,
    tenant_factions: list[str],
) -> tuple[dict[str, set[str]], dict[str, str]]:
    if not tenant_factions:
        return {}, {}
    placeholders = ",".join("?" for _ in tenant_factions)
    rows = connection.execute(
        "SELECT DISTINCT f.system_name, f.name "
        "FROM eddn_faction f "
        "WHERE f.system_name IN ("
        "SELECT DISTINCT system_name FROM eddn_faction "
        f"WHERE name IN ({placeholders})) "
        "AND (f.government IS NULL OR trim(f.government)='' OR "
        "f.allegiance IS NULL OR trim(f.allegiance)='')",
        tenant_factions,
    )
    coverage: dict[str, set[str]] = {}
    canonical: dict[str, str] = {}
    for system_name, faction_name in rows:
        system = clean(system_name)
        name = clean(faction_name)
        if not system or not name:
            continue
        key = name.casefold()
        canonical[key] = name
        coverage.setdefault(system, set()).add(key)
    return coverage, canonical


def spansh_backfill(
    connection: sqlite3.Connection,
    snapshot_database: Path | None,
    tenant_factions: list[str],
    request_limit: int,
) -> tuple[int, int, int]:
    coverage, canonical = tenant_missing_coverage(connection, tenant_factions)
    unresolved = set(canonical)
    addresses = snapshot_addresses(snapshot_database, set(coverage))
    attempted: set[str] = set()
    requests_made = 0
    resolved: dict[str, tuple[str, str, str]] = {}

    while unresolved:
        candidates = [
            (len(names & unresolved), system)
            for system, names in coverage.items()
            if system not in attempted and names & unresolved
        ]
        if not candidates:
            break
        _, system = max(candidates, key=lambda item: (item[0], item[1].casefold()))
        attempted.add(system)
        if request_limit and requests_made >= request_limit:
            break
        try:
            id64 = resolve_id64(system, addresses)
            if not id64:
                continue
            payload = request_json(f"https://spansh.co.uk/api/system/{id64}")
            record = payload.get("record")
            if not isinstance(record, dict):
                continue
            found = metadata_from_factions(record.get("minor_faction_presences"))
            for key, item in found.items():
                if key in unresolved:
                    resolved[key] = item
                    unresolved.remove(key)
            requests_made += 1
            if requests_made % 10 == 0:
                print(
                    f"Spansh fallback: {requests_made} systems, "
                    f"{len(resolved)} factions resolved, {len(unresolved)} remaining",
                    flush=True,
                )
            time.sleep(0.05)
        except Exception as error:
            print(f"Spansh fallback failed for {system}: {error}", file=sys.stderr)

    _, changed_rows = apply_metadata(connection, resolved.values())
    return requests_made, len(resolved), changed_rows


def missing_count(connection: sqlite3.Connection, tenant_factions: list[str]) -> int:
    if not tenant_factions:
        return 0
    placeholders = ",".join("?" for _ in tenant_factions)
    return int(
        connection.execute(
            "SELECT count(*) FROM eddn_faction f "
            "WHERE f.system_name IN ("
            "SELECT DISTINCT system_name FROM eddn_faction "
            f"WHERE name IN ({placeholders})) "
            "AND (f.allegiance IS NULL OR trim(f.allegiance)='')",
            tenant_factions,
        ).fetchone()[0]
    )


def main() -> int:
    args = parse_args()
    database = args.database.resolve()
    if not database.is_file():
        raise SystemExit(f"Database does not exist: {database}")
    connection = sqlite3.connect(database, timeout=60)
    try:
        connection.execute("PRAGMA busy_timeout=60000")
        ensure_columns(connection)
        target_names = tenant_faction_names(connection, args.tenant_faction)
        retained = retained_message_metadata(connection, target_names)
        factions, changed_rows = apply_metadata(connection, retained.values())
        print(
            f"Retained EDDN messages: {factions} faction identities, "
            f"{changed_rows} rows updated"
        )

        if args.spansh_fallback and args.tenant_faction:
            requests_made, resolved, spansh_rows = spansh_backfill(
                connection,
                args.snapshot_database,
                args.tenant_faction,
                max(0, args.max_spansh_requests),
            )
            print(
                f"Spansh fallback: {requests_made} system requests, "
                f"{resolved} faction identities, {spansh_rows} rows updated"
            )

        remaining = missing_count(connection, args.tenant_faction)
        print(f"Tenant-system faction rows still missing allegiance: {remaining}")
        return 0 if remaining == 0 else 2
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())

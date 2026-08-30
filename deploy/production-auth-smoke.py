"""Exercise the production dashboard auth boundary without exposing credentials.

The script creates a short-lived administrator session directly in the selected
tenant database, drives the public Next.js BFF, and removes every test record in
a finally block. It never prints JWTs, password hashes, API keys, or one-time
passwords.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import socket
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt


def request(base_url: str, path: str, cookie: str, method: str = "GET", body=None):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    headers = {"Cookie": f"valk_dashboard_session={cookie}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    call = urllib.request.Request(base_url + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(call, timeout=10) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        payload = json.loads(error.read() or b"{}")
        return error.code, payload


def bearer_request(url: str, token: str):
    call = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(call, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def login_request(base_url: str, username: str, password: str, tenant_id: str):
    payload = json.dumps(
        {"username": username, "password": password, "tenantId": tenant_id},
        separators=(",", ":"),
    ).encode()
    call = urllib.request.Request(
        base_url + "/api/session/login",
        data=payload,
        headers={"Content-Type": "application/json", "Origin": base_url},
        method="POST",
    )
    try:
        with urllib.request.urlopen(call, timeout=20) as response:
            return response.status, json.loads(response.read() or b"{}"), response.headers
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}"), error.headers


def better_auth_request(base_url: str, path: str, cookie: str):
    call = urllib.request.Request(
        base_url + path,
        headers={"Cookie": cookie, "Origin": "https://valk-elite.de"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(call, timeout=20) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def bridge_request(base_url: str, dashboard_cookie: str):
    call = urllib.request.Request(
        base_url + "/api/session/social-bridge",
        headers={
            "Cookie": f"valk_dashboard_session={dashboard_cookie}",
            "Origin": "https://valk-elite.de",
        },
        data=b"",
        method="POST",
    )
    try:
        with urllib.request.urlopen(call, timeout=20) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.headers


def expect(status: int, expected: int, label: str) -> None:
    if status != expected:
        raise RuntimeError(f"{label}: expected HTTP {expected}, received {status}")


def natural_sort_key(value: str):
    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", value)
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--tenant-id", default="valk-development")
    parser.add_argument("--base-url", default="http://127.0.0.1:8890")
    parser.add_argument("--flask-url", default="http://127.0.0.1:5000")
    parser.add_argument("--eddn-database")
    parser.add_argument("--tenant-file", default="/home/valk/valk/tenant.json")
    parser.add_argument("--resolve-address")
    parser.add_argument("--expect-secure-cookie", action="store_true")
    args = parser.parse_args()

    if args.resolve_address:
        original_getaddrinfo = socket.getaddrinfo

        def dashboard_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
            target = args.resolve_address if host == "valk-elite.de" else host
            return original_getaddrinfo(target, port, family, type, proto, flags)

        socket.getaddrinfo = dashboard_getaddrinfo

    session_secret = os.environ.get("VALK_SESSION_SECRET")
    dashboard_secret = os.environ.get("DASHBOARD_JWT_SECRET")
    if not session_secret or not dashboard_secret:
        raise RuntimeError("Dashboard signing secrets are not set")

    database_path = Path(args.database).resolve()
    tenant_values = json.loads(Path(args.tenant_file).read_text(encoding="utf-8"))
    if isinstance(tenant_values, dict):
        tenant_values = (
            tenant_values["tenants"]
            if isinstance(tenant_values.get("tenants"), list)
            else list(tenant_values.values())
        )
    tenant_config = next(
        (
            tenant
            for tenant in tenant_values
            if (
                tenant.get("id")
                or re.sub(r"[^a-z0-9]+", "-", tenant.get("name", "").lower()).strip(
                    "-"
                )
            )
            == args.tenant_id
        ),
        None,
    )
    if not tenant_config and args.tenant_id == "valk-development":
        tenant_config = next(
            (
                tenant
                for tenant in tenant_values
                if tenant.get("name") == "VALK Development"
            ),
            None,
        )
    if not tenant_config:
        raise RuntimeError("The selected tenant is unavailable")
    connection = sqlite3.connect(database_path, timeout=30)
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=30000")
    session_id = str(uuid.uuid4())
    username = f"dashboard-smoke-{int(time.time())}"
    created_user_id = None
    admin_hash_before = None
    watchlist_before = None

    try:
        admin = connection.execute(
            "SELECT id, username, password_hash FROM users "
            "WHERE active=1 AND (role='admin' OR is_admin=1) ORDER BY id LIMIT 1"
        ).fetchone()
        if not admin:
            raise RuntimeError("No active administrator found")
        admin_id, admin_username, admin_hash_before = admin
        watchlist_before = connection.execute(
            "SELECT id, schema_version, payload_json, created_at, updated_at "
            "FROM dashboard_view_preference WHERE user_id=? AND view_key='bgs-system-watchlist'",
            (admin_id,),
        ).fetchone()
        now = datetime.now(timezone.utc)
        expires = now + timedelta(minutes=10)
        connection.execute(
            "INSERT INTO dashboard_session(id, expiresAt, token, createdAt, updatedAt, "
            "lastVerifiedAt, userId) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                session_id,
                expires.isoformat(),
                hashlib.sha256(secrets.token_bytes(48)).hexdigest(),
                now.isoformat(),
                now.isoformat(),
                now.isoformat(),
                admin_id,
            ),
        )
        connection.commit()

        cookie = jwt.encode(
            {
                "sub": str(admin_id),
                "username": admin_username,
                "tenantId": args.tenant_id,
                "role": "admin",
                "verifiedAt": now.isoformat(),
                "sid": session_id,
                "mustChangePassword": False,
                "iss": "valk-dashboard-v2",
                "aud": "valk-dashboard",
                "iat": int(now.timestamp()),
                "exp": int(expires.timestamp()),
            },
            session_secret,
            algorithm="HS256",
        )
        bearer = jwt.encode(
            {
                "sub": str(admin_id),
                "tenant_id": args.tenant_id,
                "role": "admin",
                "capabilities": [
                    "dashboard:read",
                    "objectives:write",
                    "reports:send",
                    "assessment:run",
                    "data:raw",
                    "health:read",
                    "audit:read",
                    "users:read",
                    "users:manage",
                ],
                "sid": session_id,
                "jti": str(uuid.uuid4()),
                "aud": "valk-api",
                "iat": int(now.timestamp()),
                "exp": int(expires.timestamp()),
            },
            dashboard_secret,
            algorithm="HS256",
        )

        status, _ = request(args.base_url, "/api/account/access", cookie)
        expect(status, 200, "account access")
        status, bridge_headers = bridge_request(args.base_url, cookie)
        expect(status, 204, "existing-session Better Auth bridge")
        bridge_set_cookies = bridge_headers.get_all("Set-Cookie") or []
        bridged_cookie = next(
            (
                value.split(";", 1)[0]
                for value in bridge_set_cookies
                if ".session_token=" in value
            ),
            None,
        )
        if not bridged_cookie:
            raise RuntimeError("Existing dashboard session was not bridged")
        status, accounts_payload = better_auth_request(
            args.base_url,
            f"/api/auth/{args.tenant_id}/list-accounts",
            bridged_cookie,
        )
        expect(status, 200, "existing-session Better Auth account access")
        if not isinstance(accounts_payload, list):
            raise RuntimeError("Better Auth account access returned an invalid payload")
        status, _ = request(args.base_url, "/api/users", cookie)
        expect(status, 200, "user list")

        status, flask_leaderboard = bearer_request(
            f"{args.flask_url}/api/summary/leaderboard?period=cm", bearer
        )
        expect(status, 200, "Flask leaderboard")
        status, dashboard_leaderboard = request(
            args.base_url, "/api/bff/leaderboard?period=cm", cookie
        )
        expect(status, 200, "Dashboard leaderboard")
        raw_by_cmdr = {str(row.get("cmdr")): row for row in flask_leaderboard}
        view_by_cmdr = {
            str(row.get("cmdr")): row for row in dashboard_leaderboard.get("data", [])
        }
        if raw_by_cmdr.keys() != view_by_cmdr.keys():
            raise RuntimeError("Leaderboard commander set differs between Flask and dashboard")
        metric_mapping = {
            "missions_completed": "missions",
            "missions_failed": "missionFailures",
            "influence_eic": "influence",
            "total_buy": "buy",
            "total_sell": "sell",
            "profit": "profit",
            "total_volume": "volume",
            "total_quantity": "quantity",
            "bounty_vouchers": "bountyVouchers",
            "combat_bonds": "combatBonds",
            "exploration_sales": "explorationSales",
            "bounty_fines": "bountyFines",
        }
        for commander, raw_row in raw_by_cmdr.items():
            view_row = view_by_cmdr[commander]
            for raw_key, view_key in metric_mapping.items():
                raw_value = float(raw_row.get(raw_key) or 0)
                view_value = float(view_row.get(view_key) or 0)
                if raw_value != view_value:
                    raise RuntimeError(
                        f"Leaderboard metric mismatch for {commander}: {view_key}"
                    )

        status, flask_colonisation = bearer_request(
            f"{args.flask_url}/api/colonisation/contributions?period=cm", bearer
        )
        expect(status, 200, "Flask Colonisation contributions")
        status, dashboard_colonisation = request(
            args.base_url, "/api/bff/colonisation?period=cm", cookie
        )
        expect(status, 200, "Dashboard Colonisation contributions")
        raw_records = flask_colonisation.get("records", [])
        view_records = dashboard_colonisation.get("data", [])
        if len(raw_records) != len(view_records):
            raise RuntimeError("Colonisation record count differs between Flask and dashboard")
        raw_quantity = float(flask_colonisation.get("totals", {}).get("quantity") or 0)
        view_quantity = float(dashboard_colonisation.get("metrics", {}).get("delivered") or 0)
        if raw_quantity != view_quantity:
            raise RuntimeError("Colonisation delivered total differs between Flask and dashboard")

        if args.eddn_database:
            with sqlite3.connect(
                Path(args.eddn_database).resolve(), timeout=30
            ) as eddn:
                eddn.execute("PRAGMA busy_timeout=30000")
                eddn.row_factory = sqlite3.Row
                system_row = eddn.execute(
                    "SELECT system_name, population, controlling_faction "
                    "FROM eddn_system_info WHERE system_name IS NOT NULL "
                    "ORDER BY updated_at DESC LIMIT 1"
                ).fetchone()
                if not system_row:
                    raise RuntimeError("EDDN database contains no system information")
                system_name = system_row["system_name"]
                expected_factions = eddn.execute(
                    "SELECT count(*) FROM eddn_faction WHERE system_name=? COLLATE NOCASE",
                    (system_name,),
                ).fetchone()[0]
                expected_conflicts = eddn.execute(
                    "SELECT count(*) FROM eddn_conflict WHERE system_name=? COLLATE NOCASE",
                    (system_name,),
                ).fetchone()[0]
                tenant_faction = tenant_config.get("faction_name") or tenant_config.get(
                    "name"
                )
                expected_global_total = eddn.execute(
                    "SELECT count(DISTINCT system_name) FROM eddn_faction "
                    "WHERE system_name IS NOT NULL AND name=?",
                    (tenant_faction,),
                ).fetchone()[0]
                expected_global_names = sorted(
                    [
                        row[0]
                        for row in eddn.execute(
                            "SELECT DISTINCT system_name FROM eddn_faction "
                            "WHERE system_name IS NOT NULL AND name=?",
                            (tenant_faction,),
                        ).fetchall()
                    ],
                    key=natural_sort_key,
                )[:25]

            encoded_system = urllib.parse.quote(system_name, safe="")
            status, flask_system = bearer_request(
                f"{args.flask_url}/api/system-summary/{encoded_system}", bearer
            )
            expect(status, 200, "Flask EDDN system")
            status, dashboard_system = request(
                args.base_url,
                f"/api/bff/systems?system={urllib.parse.quote(system_name)}",
                cookie,
            )
            expect(status, 200, "Dashboard EDDN system")
            rows = dashboard_system.get("data", [])
            if len(rows) != 1:
                raise RuntimeError("Dashboard EDDN response does not contain exactly one system")
            view_system = rows[0]
            checks = {
                "system": system_name,
                "population": float(system_row["population"] or 0),
                "controllingFaction": system_row["controlling_faction"],
                "factionCount": expected_factions,
                "conflictCount": expected_conflicts,
            }
            for key, expected in checks.items():
                if view_system.get(key) != expected:
                    raise RuntimeError(f"EDDN mismatch for {key}")
            if flask_system.get("system_info", {}).get("system_name") != system_name:
                raise RuntimeError("Flask EDDN system differs from the source database")

            status, global_watchlist = request(
                args.base_url,
                "/api/system-watchlist/global?page=1&sort=system&direction=asc",
                cookie,
            )
            expect(status, 200, "global system watchlist")
            pagination = global_watchlist.get("pagination", {})
            if pagination.get("page_size") != 25:
                raise RuntimeError("Global watchlist returned the wrong page size")
            if pagination.get("total") != expected_global_total:
                raise RuntimeError(
                    "Global watchlist returned the wrong total: "
                    f"expected {expected_global_total}, got {pagination.get('total')}"
                )
            global_names = [
                row.get("requested_system")
                or row.get("system_info", {}).get("system_name")
                for row in global_watchlist.get("data", [])
            ]
            if global_names != expected_global_names:
                raise RuntimeError("Global watchlist returned the wrong first page")

            watchlist = {
                "systems": [
                    {
                        "system": system_name,
                        "sector": "Smoke",
                        "projectName": "Contract test",
                        "favorite": True,
                    }
                ]
            }
            status, _ = request(
                args.base_url, "/api/system-watchlist", cookie, "PUT", watchlist
            )
            expect(status, 200, "system watchlist write")
            status, watchlist_payload = request(
                args.base_url, "/api/system-watchlist/data", cookie
            )
            expect(status, 200, "system watchlist data")
            watched_systems = watchlist_payload.get("data", [])
            if len(watched_systems) != 1:
                raise RuntimeError("System watchlist returned the wrong system count")
            if (
                watched_systems[0].get("system_info", {}).get("system_name")
                != system_name
            ):
                raise RuntimeError("System watchlist returned the wrong EDDN system")
            if watchlist_payload.get("watchlist", [{}])[0].get("sector") != "Smoke":
                raise RuntimeError("System watchlist metadata round-trip mismatch")
            if watchlist_payload.get("watchlist", [{}])[0].get("favorite") is not True:
                raise RuntimeError("System watchlist favorite round-trip mismatch")
            status, _ = request(
                args.base_url, "/api/system-watchlist", cookie, "DELETE"
            )
            expect(status, 200, "system watchlist reset")

        status, payload = request(
            args.base_url,
            "/api/users",
            cookie,
            "POST",
            {"username": username, "role": "member"},
        )
        expect(status, 201, "user creation")
        if not payload.get("one_time_password") or not payload.get("user", {}).get("must_change_password"):
            raise RuntimeError("User creation did not return the one-time password contract")
        if not str(payload.get("user", {}).get("auth_email") or "").endswith("@tenant.invalid"):
            raise RuntimeError("User creation did not assign a tenant-local Better Auth identity")
        created_user_id = payload["user"]["id"]
        one_time_password = payload["one_time_password"]

        status, login_payload, login_headers = login_request(
            args.base_url,
            username,
            one_time_password,
            args.tenant_id,
        )
        expect(status, 200, "classic tenant sign-in")
        if login_payload.get("mustChangePassword") is not True:
            raise RuntimeError("One-time-password sign-in did not enforce password change")
        set_cookies = login_headers.get_all("Set-Cookie") or []
        login_cookie = next(
            (
                value.split(";", 1)[0].split("=", 1)[1]
                for value in set_cookies
                if value.startswith("valk_dashboard_session=")
            ),
            None,
        )
        if not login_cookie:
            raise RuntimeError("Classic sign-in did not set the dashboard session cookie")
        better_auth_cookie = next(
            (
                value.split(";", 1)[0]
                for value in set_cookies
                if ".session_token=" in value
            ),
            None,
        )
        if not better_auth_cookie:
            raise RuntimeError("Classic sign-in did not set the Better Auth bridge cookie")
        status, accounts_payload = better_auth_request(
            args.base_url,
            f"/api/auth/{args.tenant_id}/list-accounts",
            better_auth_cookie,
        )
        expect(status, 200, "Better Auth bridge session")
        if not any(
            account.get("providerId") == "credential"
            for account in accounts_payload
            if isinstance(account, dict)
        ):
            raise RuntimeError("Better Auth bridge session resolved the wrong user")
        if args.expect_secure_cookie:
            dashboard_cookie = next(
                value
                for value in set_cookies
                if value.startswith("valk_dashboard_session=")
            )
            required_flags = ("Secure", "HttpOnly", "SameSite=Lax")
            if not all(flag.lower() in dashboard_cookie.lower() for flag in required_flags):
                raise RuntimeError("Dashboard session cookie is missing a secure flag")
        status, _ = request(
            args.base_url, "/api/bff/leaderboard?period=cm", login_cookie
        )
        expect(status, 403, "forced password-change access restriction")

        status, _ = request(
            args.base_url,
            f"/api/users/{created_user_id}",
            cookie,
            "PATCH",
            {"username": username, "role": "member", "active": False},
        )
        expect(status, 200, "user lock")
        status, _ = request(
            args.base_url,
            f"/api/users/{created_user_id}",
            cookie,
            "PATCH",
            {"username": username, "role": "leadership", "active": True},
        )
        expect(status, 200, "user unlock and role change")
        status, payload = request(
            args.base_url,
            f"/api/users/{created_user_id}/reset-password",
            cookie,
            "POST",
            {},
        )
        expect(status, 200, "password reset")
        if not payload.get("one_time_password"):
            raise RuntimeError("Password reset did not return a one-time password")

        preference = {
            "period": "cm",
            "metric": "missions",
            "filters": {},
            "sorting": [{"id": "missions", "desc": True}],
            "visibleColumns": ["commander", "missions"],
            "pageSize": 25,
        }
        status, _ = request(
            args.base_url,
            "/api/preferences/leaderboard",
            cookie,
            "PUT",
            preference,
        )
        expect(status, 200, "preference write")
        status, payload = request(args.base_url, "/api/preferences/leaderboard", cookie)
        expect(status, 200, "preference read")
        if payload.get("data", {}).get("payload", {}).get("metric") != "missions":
            raise RuntimeError("Preference round-trip mismatch")
        status, _ = request(
            args.base_url, "/api/preferences/leaderboard", cookie, "DELETE"
        )
        expect(status, 200, "preference reset")

        status, _ = request(
            args.base_url,
            f"/api/users/{created_user_id}",
            cookie,
            "DELETE",
        )
        expect(status, 200, "user deletion")
        created_user_id = None

        preserved = connection.execute(
            "SELECT password_hash FROM users WHERE id=?", (admin_id,)
        ).fetchone()
        if not preserved or preserved[0] != admin_hash_before:
            raise RuntimeError("Administrator password hash changed during smoke test")
        print(
            "Production classic sign-in, Better Auth bridge, leaderboard parity, Colonisation parity, "
            "EDDN parity, BGS watchlist, user administration, and preference smoke test passed"
        )
        return 0
    finally:
        if created_user_id is not None:
            connection.execute("DELETE FROM users WHERE id=?", (created_user_id,))
        connection.execute(
            "DELETE FROM dashboard_view_preference WHERE user_id=(SELECT id FROM users WHERE username=?) "
            "AND view_key IN ('leaderboard','bgs-system-watchlist')",
            (admin_username if 'admin_username' in locals() else "",),
        )
        if watchlist_before is not None and 'admin_id' in locals():
            connection.execute(
                "INSERT INTO dashboard_view_preference"
                "(id,user_id,view_key,schema_version,payload_json,created_at,updated_at) "
                "VALUES(?,?,'bgs-system-watchlist',?,?,?,?)",
                (
                    watchlist_before[0],
                    admin_id,
                    watchlist_before[1],
                    watchlist_before[2],
                    watchlist_before[3],
                    watchlist_before[4],
                ),
            )
        connection.execute("DELETE FROM dashboard_session WHERE id=?", (session_id,))
        connection.commit()
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())

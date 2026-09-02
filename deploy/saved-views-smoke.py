"""Check real preference persistence using disposable keys and short-lived sessions.

Never touches a user's existing preferences or prints authentication material.
Requires the same runtime environment and Python JWT dependency as the auth smoke.
"""
import argparse
import hashlib
import json
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt


def call(base, path, cookie, method="GET", body=None):
    request = urllib.request.Request(
        base + path,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Cookie": f"valk_dashboard_session={cookie}",
                 "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def checked(base, path, cookie, method="GET", body=None):
    status, payload = call(base, path, cookie, method, body)
    if status != 200:
        raise RuntimeError(f"{method} {path}: HTTP {status}")
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8890")
    args = parser.parse_args()
    config_path = Path(os.environ["VALK_TENANT_FILE"])
    tenants = json.loads(config_path.read_text())
    if isinstance(tenants, dict):
        tenants = tenants.get("tenants") or list(tenants.values())
    key = "deployment-views-" + uuid.uuid4().hex
    endpoint = "/api/preferences/" + key
    for tenant in tenants:
        tenant_id = tenant.get("id") or re.sub(r"[^a-z0-9]+", "-", tenant["name"].lower()).strip("-")
        uri = tenant["db_uri"]
        if not uri.startswith("sqlite:///"):
            raise RuntimeError("Unsupported tenant database")
        path = Path(uri[len("sqlite:///"):])
        if not path.is_absolute():
            path = Path(os.environ.get("VALK_TENANT_DB_ROOT", config_path.parent)) / path
        db = sqlite3.connect(f"file:{path}?mode=rw", uri=True, timeout=30)
        session_ids = []
        user_ids = []
        try:
            users = db.execute(
                "SELECT id,username,role,is_admin FROM users WHERE active=1 "
                "AND COALESCE(must_change_password,0)=0 ORDER BY id LIMIT 2"
            ).fetchall()
            if not users:
                raise RuntimeError("No active user for tenant smoke test")
            cookies = []
            now = datetime.now(timezone.utc)
            expires = now + timedelta(minutes=10)
            for user_id, username, role, is_admin in users:
                sid = str(uuid.uuid4())
                session_ids.append(sid)
                user_ids.append(user_id)
                db.execute(
                    "INSERT INTO dashboard_session(id,expiresAt,token,createdAt,updatedAt,lastVerifiedAt,userId) "
                    "VALUES(?,?,?,?,?,?,?)",
                    (sid, expires.isoformat(), hashlib.sha256(secrets.token_bytes(48)).hexdigest(),
                     now.isoformat(), now.isoformat(), now.isoformat(), user_id),
                )
                cookies.append(jwt.encode({
                    "sub": str(user_id), "username": username, "tenantId": tenant_id,
                    "role": "admin" if is_admin else (role or "member"),
                    "verifiedAt": now.isoformat(), "sid": sid, "mustChangePassword": False,
                    "iss": "valk-dashboard-v2", "aud": "valk-dashboard",
                    "iat": int(now.timestamp()), "exp": int(expires.timestamp()),
                }, os.environ["VALK_SESSION_SECRET"], algorithm="HS256"))
            db.commit()
            cookie = cookies[0]
            assert checked(args.base_url, endpoint, cookie)["data"] is None
            view = {"search": "Smoke", "filters": {"system": ["Sol", "Achenar"]},
                    "sorting": [{"id": "system", "desc": True}],
                    "visibleColumns": ["system"], "pageSize": 50}
            timestamp = now.isoformat().replace("+00:00", "Z")
            views = [{"id": f"smoke-{index}", "name": f"Smoke {index}", "view": view,
                      "createdAt": timestamp, "updatedAt": timestamp} for index in range(20)]
            collection = {"current": view, "activeViewId": "smoke-0", "views": views}
            checked(args.base_url, endpoint, cookie, "PUT", collection)
            stored = checked(args.base_url, endpoint, cookie)["data"]
            assert stored["schema_version"] == 3 and stored["payload"] == collection
            if len(cookies) > 1:
                assert checked(args.base_url, endpoint, cookies[1])["data"] is None
            collection["views"][0]["name"] = "Renamed smoke view"
            collection["current"] = {"filters": {}, "sorting": [], "visibleColumns": [], "pageSize": 25}
            collection["activeViewId"] = None
            checked(args.base_url, endpoint, cookie, "PUT", collection)
            assert checked(args.base_url, endpoint, cookie)["data"]["payload"] == collection
            collection["current"] = view
            collection["activeViewId"] = "smoke-0"
            collection["views"].pop()
            checked(args.base_url, endpoint, cookie, "PUT", collection)
            assert checked(args.base_url, endpoint, cookie)["data"]["payload"] == collection
            checked(args.base_url, endpoint, cookie, "DELETE")
            assert checked(args.base_url, endpoint, cookie)["data"] is None
            print(f"PASS {tenant_id}: 20 named views, filters/sort, rename, reset, restore, delete; "
                  f"user isolation {'checked' if len(cookies) > 1 else 'not available (one user)'}")
        finally:
            for user_id in user_ids:
                db.execute("DELETE FROM dashboard_view_preference WHERE user_id=? AND view_key=?", (user_id, key))
            for sid in session_ids:
                db.execute("DELETE FROM dashboard_session WHERE id=?", (sid,))
            db.commit()
            db.close()
    print("All temporary preferences and sessions removed.")


if __name__ == "__main__":
    main()

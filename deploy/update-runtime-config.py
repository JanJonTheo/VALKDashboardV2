"""Atomically add shared dashboard auth settings without printing secrets."""

from __future__ import annotations

import os
import secrets
import stat
import sys
import tempfile
from pathlib import Path


def read_env(path: Path) -> tuple[list[str], dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    values: dict[str, str] = {}
    for line in lines:
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    return lines, values


def update_env(path: Path, updates: dict[str, str]) -> None:
    lines, _ = read_env(path)
    replaced: set[str] = set()
    output: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0] if "=" in line and not line.lstrip().startswith("#") else None
        if key in updates:
            output.append(f"{key}={updates[key]}")
            replaced.add(key)
        else:
            output.append(line)
    if output and output[-1] != "":
        output.append("")
    for key, value in updates.items():
        if key not in replaced:
            output.append(f"{key}={value}")
    output.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o600
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write("\n".join(output))
        temporary = Path(handle.name)
    os.chmod(temporary, mode)
    os.replace(temporary, path)


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: update-runtime-config.py DASHBOARD_ENV FLASK_ENV")
    dashboard_path, flask_path = map(Path, sys.argv[1:])
    _, dashboard = read_env(dashboard_path)
    _, flask = read_env(flask_path)
    jwt_secret = dashboard.get("DASHBOARD_JWT_SECRET") or flask.get("DASHBOARD_JWT_SECRET") or secrets.token_urlsafe(48)
    better_auth_secret = dashboard.get("BETTER_AUTH_SECRET") or secrets.token_urlsafe(48)
    update_env(flask_path, {"DASHBOARD_JWT_SECRET": jwt_secret})
    update_env(
        dashboard_path,
        {
            "DASHBOARD_JWT_SECRET": jwt_secret,
            "BETTER_AUTH_SECRET": better_auth_secret,
            "VALK_TENANT_DB_ROOT": "/home/valk",
            "VALK_EDDN_DATABASE": "/home/valk/db/bgs_data_eddn.db",
            "VALK_SOCIAL_AUTH_ENABLED": "false",
            "NEXT_PUBLIC_VALK_SOCIAL_AUTH_ENABLED": "false",
        },
    )
    print("Dashboard JWT, tenant DB root and disabled-by-default social auth settings updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Atomically switch the native dashboard runtime to its HTTPS proxy mode."""

from __future__ import annotations

import os
import stat
import sys
import tempfile
from pathlib import Path


UPDATES = {
    "VALK_PUBLIC_URL": "https://valk-elite.de",
    "VALK_COOKIE_SECURE": "true",
    "HOSTNAME": "127.0.0.1",
    "PORT": "8889",
}


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: enable-https-runtime.py DASHBOARD_ENV")
    path = Path(sys.argv[1])
    original = path.read_text(encoding="utf-8").splitlines()
    output: list[str] = []
    replaced: set[str] = set()
    for line in original:
        key = line.split("=", 1)[0] if "=" in line and not line.lstrip().startswith("#") else None
        if key in UPDATES:
            output.append(f"{key}={UPDATES[key]}")
            replaced.add(key)
        else:
            output.append(line)
    if output and output[-1] != "":
        output.append("")
    output.extend(f"{key}={value}" for key, value in UPDATES.items() if key not in replaced)
    output.append("")

    metadata = path.stat()
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        handle.write("\n".join(output))
        temporary = Path(handle.name)
    os.chmod(temporary, stat.S_IMODE(metadata.st_mode))
    os.chown(temporary, metadata.st_uid, metadata.st_gid)
    os.replace(temporary, path)
    print("Dashboard runtime switched to HTTPS proxy mode.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

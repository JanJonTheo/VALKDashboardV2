import json
import runpy
import sqlite3
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
module = runpy.run_path(str(ROOT / "deploy/merge-system-watchlist.py"))


class MergeWatchlistTest(unittest.TestCase):
    def test_dry_run_merge_and_repeat_preserve_unrelated_entries_and_favorites(self):
        connection = sqlite3.connect(":memory:")
        connection.executescript("""
            CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT);
            INSERT INTO users VALUES(1,'jjt');
            CREATE TABLE dashboard_view_preference(
                id TEXT,user_id INTEGER,view_key TEXT,schema_version INTEGER,
                payload_json TEXT,created_at TEXT,updated_at TEXT,UNIQUE(user_id,view_key));
        """)
        old = {"systems": [
            {"system": "Pueloi EL-P d5-258", "projectName": "Uttgard", "sector": "", "favorite": True},
            {"system": "Unrelated", "projectName": "Keep", "sector": "APUS", "favorite": True},
        ]}
        connection.execute("INSERT INTO dashboard_view_preference VALUES('p',1,'bgs-system-watchlist',2,?,'old','old')", (json.dumps(old),))
        connection.commit()
        entries = module["load_entries"](ROOT / "deploy/galtea-watchlist.csv")
        self.assertEqual(len(entries), 29)
        summary = module["merge"](connection, "JJT", entries)
        self.assertEqual(summary, {"mapped": 29, "added": 28, "total": 30})
        self.assertEqual(json.loads(connection.execute("SELECT payload_json FROM dashboard_view_preference").fetchone()[0]), old)
        with tempfile.TemporaryDirectory() as directory:
            module["merge"](connection, "jjt", entries, Path(directory) / "backup.json")
            repeat = module["merge"](connection, "jjt", entries, Path(directory) / "repeat.json")
            self.assertEqual(repeat["added"], 0)
        systems = json.loads(connection.execute("SELECT payload_json FROM dashboard_view_preference").fetchone()[0])["systems"]
        self.assertEqual(systems[0]["projectName"], "Utgard")
        self.assertTrue(systems[0]["favorite"])
        self.assertEqual(systems[1], old["systems"][1])
        self.assertEqual(connection.execute("SELECT count(*) FROM dashboard_watchlist_system_label WHERE sector='GALTEA'").fetchone()[0], 29)
        connection.close()


if __name__ == "__main__":
    unittest.main()

"""Repair empty BGS packages and recover a confirmed, still-active personal gap alert.

Defaults to a read-only preview. --apply requires a fresh SQLite backup path.
Historical recovery only creates dashboard alerts; it does not enqueue Discord delivery.
"""

import argparse
import json
from pathlib import Path
import sqlite3
import sys
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-dir", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--snapshots", required=True)
    parser.add_argument("--faction", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--recover-system", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup")
    args = parser.parse_args()
    sys.path.insert(0, str(Path(args.backend_dir).resolve()))
    from sqlalchemy import create_engine, text
    from bgs_rules import restore_empty_rule_package, utc_now, watchlist_systems
    from bgs_rule_scheduler import evaluate_rule, _alert_copy, _event_facts, _parse_ticktime

    database = Path(args.database).resolve()
    if args.apply:
        if not args.backup or Path(args.backup).exists():
            parser.error("--apply requires a new --backup file")
        with sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True) as source:
            with sqlite3.connect(args.backup) as backup:
                source.backup(backup)
        Path(args.backup).chmod(0o600)

    engine = create_engine(f"sqlite:///file:{database.as_posix()}?mode={'rw' if args.apply else 'ro'}&uri=true")
    with engine.begin() as conn:
        user = conn.execute(text("SELECT id FROM users WHERE username=:username"), {"username": args.username}).scalar_one()
        packages = conn.execute(text(
            "SELECT p.* FROM dashboard_bgs_rule_package p "
            "JOIN dashboard_bgs_rule_template t ON t.id=p.template_id "
            "WHERE p.owner_scope='tenant' AND t.archived_at IS NULL "
            "AND NOT EXISTS (SELECT 1 FROM dashboard_bgs_rule r WHERE r.package_id=p.id)"
        )).mappings().all()
        print(json.dumps({"empty_packages": [p["id"] for p in packages], "apply": args.apply}))
        for package in packages:
            template = conn.execute(text("SELECT * FROM dashboard_bgs_rule_template WHERE id=:id"), {"id": package["template_id"]}).mappings().one()
            if args.apply:
                restore_empty_rule_package(conn, package, template, user)

        if args.recover_system.casefold() not in {name.casefold() for name in watchlist_systems(conn, user)}:
            raise ValueError("Recovery system is not on this user's watchlist")
        with sqlite3.connect(f"file:{Path(args.snapshots).resolve().as_posix()}?mode=ro", uri=True) as snapshots:
            snapshots.row_factory = sqlite3.Row
            observations = [dict(row) for row in snapshots.execute(
                "SELECT ticktime,payload_json FROM system_tick_snapshot "
                "WHERE system_name=? AND is_settled=1 ORDER BY ticktime DESC LIMIT 40",
                (args.recover_system,),
            )]
        rules = conn.execute(text(
            "SELECT * FROM dashboard_bgs_rule WHERE owner_scope='personal' AND owner_user_id=:user "
            "AND enabled=1 AND condition_type='tenant_faction_gap' "
            "AND (target_scope='watchlist_all' OR lower(target_system)=lower(:system))"
        ), {"user": user, "system": args.recover_system}).mappings().all()
        recovered = []
        for row in rules:
            rule = dict(row)
            current = evaluate_rule(rule, observations, args.faction)
            remaining = set(current.get("active_event_keys") or [])
            for index in range(len(observations) - 1):
                result = evaluate_rule(rule, observations[index:index + 2], args.faction)
                if result.get("active") is None:
                    break
                remaining &= set(result.get("active_event_keys") or [])
                for event in sorted(remaining & set(result.get("events") or [])):
                    facts = _event_facts(rule["condition_type"], result["facts"], event)
                    if _parse_ticktime(facts["ticktime"]) < _parse_ticktime(rule["effective_from"] or rule["created_at"]):
                        continue
                    facts["recovered"] = True
                    title, message = _alert_copy(rule, args.recover_system, facts)
                    recovered.append({"rule": rule["id"], "event": event, "ticktime": facts["ticktime"]})
                    if args.apply:
                        conn.execute(text(
                            "INSERT INTO dashboard_bgs_alert(id,rule_id,rule_name,owner_scope,owner_user_id,"
                            "system_key,system_name,severity,title,message,facts_json,event_key,fired_ticktime,fired_at) "
                            "VALUES (:id,:rule,:name,'personal',:user,:key,:system,:severity,:title,:message,:facts,:event,:tick,:now) "
                            "ON CONFLICT DO NOTHING"
                        ), {"id": str(uuid.uuid4()), "rule": rule["id"], "name": rule["name"], "user": user,
                            "key": args.recover_system.casefold(), "system": args.recover_system,
                            "severity": rule["severity"], "title": title, "message": message,
                            "facts": json.dumps(facts), "event": event, "tick": facts["ticktime"], "now": utc_now()})
                    remaining.remove(event)
                if not remaining:
                    break
        print(json.dumps({"recoverable_personal_alerts": recovered}))
    engine.dispose()


if __name__ == "__main__":
    main()

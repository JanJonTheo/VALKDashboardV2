# BGS alert housekeeping

Personal alerts can be resolved or deleted by their owner. Shared alerts, including protected-faction alerts, require the tenant's admin role; leadership alone does not grant this permission. The API returns `can_manage` for each visible alert.

`POST /api/bgs-alerts/{id}/resolve` marks an alert resolved and cancels pending/retry deliveries. Repeating the action preserves the original resolution time. Mark read remains user-local and does not resolve alerts. The redundant Acknowledge action is no longer shown; existing acknowledgement data and the legacy API remain compatible.

`DELETE /api/bgs-alerts/{id}` permanently deletes the alert and its delivery and user-state records. The UI requires confirmation and explains the tenant-wide effect. Missing/deleted alerts return 404; unauthorized shared operations return 403. Previously posted Discord messages are retained. Already claimed deliveries may finish.

The backend runs housekeeping every hour, starting two minutes after startup. It deletes alerts resolved at least ten days ago, using UTC, in transactions of up to 250 alerts. Active alerts and invalid resolution timestamps are retained. Failures are logged per tenant without interrupting other tenants.

Schema migration 8 installs a resolution-time index and tenant-local tombstones. SQLite triggers atomically preserve the rule/system/event/tick identity on deletion and suppress insertion of that exact identity. New events/ticks can still create alerts. Tombstones contain no message content and are removed when their rule is deleted. No rule configuration or evaluation state is changed by manual lifecycle actions.

Before initial activation, back up each tenant database and preview candidates with:

```sql
SELECT count(*) FROM dashboard_bgs_alert
WHERE resolved_at IS NOT NULL
  AND julianday(resolved_at) <= julianday('now', '-10 days');
```

Back up the backend files, build a separate dashboard release, deploy `bgs_alert_housekeeping.py` together with `dashboard_users.py`, `bgs_rules.py`, and `bgs_rule_scheduler.py`, then restart the backend and activate the new dashboard release. Look for `BGS alert housekeeping for <tenant>: deleted=<count>` in backend logs. The schema changes are additive; reverting application files stops scheduled cleanup but cannot recover deleted alerts without the database backup.

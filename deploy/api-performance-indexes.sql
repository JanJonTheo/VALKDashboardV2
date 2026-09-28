-- Idempotent tenant-database migration, applied to all three production tenants
-- on 2026-09-27 after online backups and query-equivalence checks.
-- See docs/API-PERFORMANCE.md for parity results and rollout considerations.
-- Run against the intended tenant DB, not the EDDN/snapshot database.
BEGIN IMMEDIATE;
CREATE INDEX IF NOT EXISTS idx_market_buy_event_id ON market_buy_event(event_id);
CREATE INDEX IF NOT EXISTS idx_market_sell_event_id ON market_sell_event(event_id);
CREATE INDEX IF NOT EXISTS idx_mission_completed_event_id ON mission_completed_event(event_id);
CREATE INDEX IF NOT EXISTS idx_mission_failed_event_id ON mission_failed_event(event_id);
CREATE INDEX IF NOT EXISTS idx_commit_crime_event_id ON commit_crime_event(event_id);
CREATE INDEX IF NOT EXISTS idx_event_cmdr_tickid ON event(cmdr, tickid);
CREATE INDEX IF NOT EXISTS idx_event_type ON event(event);
COMMIT;

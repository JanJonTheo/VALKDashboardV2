// @vitest-environment node
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluationHistoryRange } from "@/lib/evaluation-history";
import { evaluationHistoryQuery } from "@/lib/evaluation-history-server";
import { leaderboardMetricOptions } from "@/lib/preferences";

vi.mock("server-only", () => ({}));

describe("evaluation history SQL", () => {
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(":memory:");
    database.exec(`
      CREATE TABLE event (id INTEGER PRIMARY KEY, timestamp TEXT, cmdr TEXT, tickid TEXT);
      CREATE TABLE market_buy_event (event_id INTEGER, value REAL, count REAL);
      CREATE TABLE market_sell_event (event_id INTEGER, value REAL, count REAL);
      CREATE TABLE mission_completed_event (id INTEGER PRIMARY KEY, event_id INTEGER);
      CREATE TABLE mission_failed_event (event_id INTEGER);
      CREATE TABLE mission_completed_influence (
        event_id INTEGER,
        mission_id INTEGER,
        faction_name TEXT,
        influence TEXT
      );
      CREATE TABLE redeem_voucher_event (event_id INTEGER, amount REAL, type TEXT);
      CREATE TABLE sell_exploration_data_event (event_id INTEGER, earnings REAL);
      CREATE TABLE multi_sell_exploration_data_event (event_id INTEGER, total_earnings REAL);
      CREATE TABLE commit_crime_event (event_id INTEGER, bounty REAL);

      INSERT INTO event (id, timestamp, cmdr, tickid) VALUES
        (1, '2026-09-03T15:01:00Z', 'Valkyrie', 'tick-1'),
        (2, '2026-09-03T15:02:00Z', 'Valkyrie', 'tick-1'),
        (3, '2026-09-03T15:03:00Z', 'Valkyrie', 'tick-1'),
        (4, '2026-09-03T15:04:00Z', 'Valkyrie', 'tick-1'),
        (5, '2026-09-03T15:05:00Z', 'Valkyrie', 'tick-1'),
        (6, '2026-09-03T15:06:00Z', 'Valkyrie', 'tick-1'),
        (7, '2026-09-03T15:07:00Z', 'Valkyrie', 'tick-1'),
        (8, '2026-09-03T15:08:00Z', 'Valkyrie', 'tick-1'),
        (9, '2026-09-03T15:09:00Z', 'Valkyrie', 'tick-1');
      INSERT INTO market_buy_event VALUES (1, 100, 2);
      INSERT INTO market_sell_event VALUES (2, 150, 3);
      INSERT INTO mission_completed_event VALUES (30, 3);
      INSERT INTO mission_failed_event VALUES (4);
      INSERT INTO mission_completed_influence VALUES (3, 30, 'VALK Squadron', '+++');
      INSERT INTO redeem_voucher_event VALUES (5, 1000, 'bounty');
      INSERT INTO redeem_voucher_event VALUES (6, 2000, 'CombatBond');
      INSERT INTO sell_exploration_data_event VALUES (7, 300);
      INSERT INTO multi_sell_exploration_data_event VALUES (8, 400);
      INSERT INTO commit_crime_event VALUES (9, 50);
    `);
  });

  afterEach(() => database.close());

  it("aggregates every selectable metric into the matching UTC bucket", () => {
    const range = evaluationHistoryRange({
      period: "cd",
      now: new Date("2026-09-03T16:00:00Z"),
    });
    const expected = {
      missions: 1,
      missionFailures: 1,
      influence: 3,
      buy: 100,
      sell: 150,
      profit: 50,
      volume: 250,
      quantity: 5,
      bountyVouchers: 1000,
      combatBonds: 2000,
      explorationSales: 700,
      bountyFines: 50,
    } as const;

    for (const { value: metric } of leaderboardMetricOptions) {
      const query = evaluationHistoryQuery(
        metric,
        range.buckets,
        "VALK Squadron",
      );
      const rows = database.prepare(query.sql).all(query.parameters) as Array<{
        bucket: string;
        cmdr: string;
        value: number;
      }>;
      expect(rows, metric).toEqual([
        { bucket: "15", cmdr: "Valkyrie", value: expected[metric] },
      ]);
    }
  });
});

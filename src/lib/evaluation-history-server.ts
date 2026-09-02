import "server-only";

import type { EvaluationHistoryBucket } from "./evaluation-history";
import type { LeaderboardMetric } from "./preferences";

interface EvaluationHistoryQuery {
  sql: string;
  parameters: Record<string, string | number>;
}

function bucketExpression(alias: string, buckets: EvaluationHistoryBucket[]) {
  return `CASE
    ${buckets
      .map(
        (bucket, index) =>
          `WHEN ${alias}.timestamp >= :bucket_${index}_start AND ${alias}.timestamp < :bucket_${index}_end THEN '${bucket.key}'`,
      )
      .join("\n    ")}
  END`;
}

function rangeClause(alias: string) {
  return `${alias}.timestamp >= :range_start AND ${alias}.timestamp < :range_end`;
}

function marketQuery(
  metric: Extract<
    LeaderboardMetric,
    "buy" | "sell" | "profit" | "volume" | "quantity"
  >,
  bucket: string,
) {
  const buy =
    "SUM(CASE WHEN mb.event_id IS NOT NULL THEN COALESCE(mb.value, 0) ELSE 0 END)";
  const sell =
    "SUM(CASE WHEN ms.event_id IS NOT NULL THEN COALESCE(ms.value, 0) ELSE 0 END)";
  const buyCount =
    "SUM(CASE WHEN mb.event_id IS NOT NULL THEN COALESCE(mb.count, 0) ELSE 0 END)";
  const sellCount =
    "SUM(CASE WHEN ms.event_id IS NOT NULL THEN COALESCE(ms.count, 0) ELSE 0 END)";
  const value = {
    buy,
    sell,
    profit: `CASE WHEN ${sell} > 0 THEN ${sell} - ${buy} ELSE 0 END`,
    volume: `${buy} + ${sell}`,
    quantity: `${buyCount} + ${sellCount}`,
  }[metric];
  return `
    SELECT ${bucket} AS bucket, e.cmdr, ${value} AS value
    FROM event e
    LEFT JOIN market_buy_event mb ON mb.event_id = e.id
    LEFT JOIN market_sell_event ms ON ms.event_id = e.id
    WHERE e.cmdr IS NOT NULL AND ${rangeClause("e")}
    GROUP BY bucket, e.cmdr
  `;
}

function simpleMetricQuery(
  table: string,
  value: string,
  bucket: string,
  extraWhere = "",
) {
  return `
    SELECT ${bucket} AS bucket, e.cmdr, ${value} AS value
    FROM ${table} metric
    JOIN event e ON e.id = metric.event_id
    WHERE e.cmdr IS NOT NULL AND ${rangeClause("e")} ${extraWhere}
    GROUP BY bucket, e.cmdr
  `;
}

export function evaluationHistoryQuery(
  metric: LeaderboardMetric,
  buckets: EvaluationHistoryBucket[],
  factionName: string,
): EvaluationHistoryQuery {
  if (!buckets.length) throw new Error("The selected history range is empty");
  const eventBucket = bucketExpression("e", buckets);
  const parameters: Record<string, string | number> = {
    range_start: buckets[0].start,
    range_end: buckets[buckets.length - 1].end,
  };
  for (const [index, bucket] of buckets.entries()) {
    parameters[`bucket_${index}_start`] = bucket.start;
    parameters[`bucket_${index}_end`] = bucket.end;
  }

  let sql: string;
  switch (metric) {
    case "buy":
    case "sell":
    case "profit":
    case "volume":
    case "quantity":
      sql = marketQuery(metric, eventBucket);
      break;
    case "missions":
      sql = simpleMetricQuery(
        "mission_completed_event",
        "COUNT(*)",
        eventBucket,
      );
      break;
    case "missionFailures":
      sql = simpleMetricQuery("mission_failed_event", "COUNT(*)", eventBucket);
      break;
    case "bountyVouchers":
      sql = simpleMetricQuery(
        "redeem_voucher_event",
        "SUM(COALESCE(metric.amount, 0))",
        eventBucket,
        "AND metric.type = 'bounty'",
      );
      break;
    case "combatBonds":
      sql = simpleMetricQuery(
        "redeem_voucher_event",
        "SUM(COALESCE(metric.amount, 0))",
        eventBucket,
        "AND metric.type = 'CombatBond'",
      );
      break;
    case "bountyFines":
      sql = simpleMetricQuery(
        "commit_crime_event",
        "SUM(COALESCE(metric.bounty, 0))",
        eventBucket,
      );
      break;
    case "explorationSales": {
      const sellBucket = bucketExpression("e", buckets);
      sql = `
        SELECT bucket, cmdr, SUM(value) AS value
        FROM (
          SELECT ${sellBucket} AS bucket, e.cmdr, COALESCE(metric.earnings, 0) AS value
          FROM sell_exploration_data_event metric
          JOIN event e ON e.id = metric.event_id
          WHERE e.cmdr IS NOT NULL AND ${rangeClause("e")}
          UNION ALL
          SELECT ${sellBucket} AS bucket, e.cmdr, COALESCE(metric.total_earnings, 0) AS value
          FROM multi_sell_exploration_data_event metric
          JOIN event e ON e.id = metric.event_id
          WHERE e.cmdr IS NOT NULL AND ${rangeClause("e")}
        ) exploration
        GROUP BY bucket, cmdr
      `;
      break;
    }
    case "influence": {
      const influenceBucket = bucketExpression("ex", buckets);
      parameters.faction_name_like = `%${factionName}%`;
      sql = `
        SELECT ${influenceBucket} AS bucket, ex.cmdr,
          SUM(LENGTH(metric.influence)) AS value
        FROM mission_completed_influence metric
        JOIN mission_completed_event mission ON (
          (metric.event_id IS NOT NULL AND mission.id = metric.mission_id)
          OR (metric.event_id IS NULL AND mission.event_id = metric.mission_id)
        )
        JOIN event ex ON ex.id = mission.event_id
        WHERE ex.cmdr IS NOT NULL
          AND metric.faction_name LIKE :faction_name_like
          AND ${rangeClause("ex")}
        GROUP BY bucket, ex.cmdr
      `;
      break;
    }
  }

  return { sql, parameters };
}

# API performance review — 27 September 2026

## Production rollout completed

Activated on **27 September 2026 at approximately 11:30–11:33 Europe/Berlin**.
Public dashboard: `https://valk-elite.de`. Active release:
`/home/valk/dashboard-v2/releases/20260927-api-performance`.

- Watchlist history now uses the existing system/time index, with a schema guard.
- Seven additional indexes are installed in all three tenant databases: the six
  leaderboard indexes below plus `event(event)` for the filter catalog. Distinct
  event values were verified unchanged before/after that additional index.
- Explorer catalogs require one upstream request. Search is Unicode-aware and
  paginated on the server; whole-result transfers are reserved for explicit exports.
- Flask serves four workers using request-local sessions and bounded, reusable
  tenant connection pools. Alert deliveries are fetched in a single batch.
- Cancellation, retry handling and timing diagnostics are deployed.

Observed production HTTP timings for VALK Development (single calls, not p95):

| Operation                  |                     Before |                                    After |
| -------------------------- | -------------------------: | ---------------------------------------: |
| Watchlist, same 86 systems |                   5,714 ms | 86 ms (earlier post-deploy call: 156 ms) |
| Current-tick leaderboard   |                   1,296 ms |                                    57 ms |
| All-time leaderboard       |                   1,465 ms |                                   209 ms |
| Event filter catalog       | 191 upstream page requests |       1 request, 88 ms through HTTPS/BFF |

The final public smoke run also measured home at 46 ms and alerts at 31 ms for
VALK Development. Wide JSON/text searches still scan rows: a no-match query took
1.4 seconds for VALK Development and 5.8 seconds for the larger EIC tenant.
The EIC catalog is now about 196 ms after the additional event-type index.
These are remaining performance limits, not observed timeouts. No queue warnings
were recorded between the backend restart and the first post-deploy log check;
this short observation is not a long-term availability guarantee.

Validation completed: **201 dashboard unit tests**, **136 backend tests plus
31 subtests**, **8 Discord bot smoke tests**, and **41 browser checks across
desktop/tablet/phone** passed (four existing viewport-specific skips). Obsolete
conflict wording/layout expectations and a missing alert fixture field were fixed.
Six isolation/search/index tests also passed in the server's Python runtime.
Type checking, ESLint and the Linux production build pass. The Linux build uses
`next build --webpack` because Turbopack rejects the deployment's shared
`node_modules` symlink outside the release root; dependency manifests match the
previous release and the native SQLite runtime check passes.

Internal-port and public HTTPS smoke tests verified actual logins and BFF routes
for all three tenants. Twelve concurrent API reads matched their own tenant's
expected records exactly. Temporary test users and sessions were removed.
Public health reports all three tenant databases configured. No test notifications
were sent. Measurements: `API-PERFORMANCE-PRODUCTION.json` and
`API-PERFORMANCE-AFTER.json`; the earlier internal preflight is retained separately.

### Backup and rollback

Verified SQLite online backups of all three tenant databases and the four
replaced backend source files are in the restricted directory
`/home/valk/dashboard-v2/shared/api-performance-20260927/backup/`.
`manifest.json` records original source hashes and the preceding dashboard release.

To roll back application code, restore `app.py`, `models.py`, `databases.py` and
`bgs_rules.py` from that directory, then restart `valkflask`. Restore the dashboard
`current` symlink to `releases/20260911-conflict-updates`, stop the new dashboard
process and run that release's `deploy/ensure-native.sh`. The additional indexes
are backward-compatible and can remain in place. Do not restore whole database
backups over newer user activity for an application rollback.

Disk space was already low before this rollout. Only the new release's disposable
483 MB build cache was removed; all backups and previous releases were retained.
The server has approximately 1 GB free and needs a separate capacity/retention review.

## Original assessment (before rollout)

## Scope and evidence

The initial assessment reviewed the dashboard, the adjacent `EICFlaskServer` checkout and the deployed
Flask service. With user authorization, measured the production **VALK Development**
database and read-only API endpoints on 27 September, approximately 10:13–10:18
Europe/Berlin. No production settings, services or database contents/schema were
changed during that assessment. Candidate leaderboard indexes were created only in a disposable
in-memory online backup on the server.

The local `bgs_data_valk.db` snapshot (last modified 2 September) contains 25,676
events. It was opened read-only. Its event listing uses `idx_event_timestamp`
according to `EXPLAIN QUERY PLAN`; recommending another timestamp index would
therefore be premature. A leaderboard benchmark could not run against that
snapshot because it lacks the current `mission_completed_influence.event_id`
column. The subsequent remote measurements below supersede that local limitation.

## Production measurements

| Operation                                         | Existing SQL | Candidate SQL | Result verification                                |
| ------------------------------------------------- | -----------: | ------------: | -------------------------------------------------- |
| Watchlist history, 86 systems / 8-day lookup      |  3,639.23 ms |       3.04 ms | All 111 rows exactly equal in one read transaction |
| Current-tick leaderboard, same in-memory snapshot |  1,075.21 ms |       5.81 ms | All 4 commander rows exactly equal                 |
| All-time leaderboard, same in-memory snapshot     |    603.54 ms |     160.15 ms | All 8 commander rows exactly equal                 |

These are individual SQL measurements, **not** end-to-end page improvements,
percentiles or a load test. The leaderboard before/after comparison used the
same in-memory backup to avoid comparing disk and memory storage. Watchlist
comparison used the live snapshot DB read-only and an existing index; no index
was created there. Cache warming, concurrent ingestion and system load can
affect timings. More dates, tenants and write-throughput tests are needed before
broad rollout.

Sequential HTTP requests against the existing production Flask service returned:

- Current-tick leaderboard: **1,295.73 ms**, HTTP 200.
- All-time leaderboard: **1,465.25 ms**, HTTP 200.
- First 250 event rows: **21.95 ms**, HTTP 200, 304,257 bytes.
- Largest saved personal watchlist (86 systems, 7 history days): **5,714.44 ms**,
  HTTP 200, 197,533 bytes. This was a read-only data POST.

Production has **47,750 events**, 179 alerts and 177 notification-delivery records
at measurement time. The event catalog therefore requires **191 upstream page
requests** with the current implementation, plus the visible page. Three direct
distinct-value queries returned only 8 commanders, 25 event types and 176 tick
IDs in about **308 ms combined**, suggesting a compact catalog endpoint can
remove considerable transfer and request overhead.

The active `valkflask` service runs `/home/valk/valk/app.py`; the deployed startup
specifies **one Waitress thread**. A bounded journal read covering the last 24
hours returned 6,192 lines with **566 task-queue warnings**, maximum reported
queue depth **95**, and one `database is locked` mention. These are log-event
counts, not request counts or a measured timeout rate. They directly establish
that queueing is occurring, while individual timeout attribution still needs
correlated request traces.

Raw plans and bounded SQL/API measurements are in
`API-PERFORMANCE-MEASUREMENTS.json` and `WATCHLIST-PERFORMANCE-MEASUREMENTS.json`.
The reproducible diagnostic scripts are `deploy/measure-api-performance.py`
and `deploy/measure-watchlist-performance.py`. They use SQLite read-only
connections for production reads and print no result rows or credentials.

## Findings, in priority order

1. **Watchlist history selects a low-selectivity index.** The approximately
   1.95 GB snapshot database has no `sqlite_stat1` statistics. SQLite chooses
   `ix_system_tick_snapshot_is_settled`, filtering systems and dates afterward.
   The existing `ix_snapshot_system_ticktime(system_name, ticktime)` makes the
   identical query over a thousand times faster in this sample when selected
   explicitly with `INDEXED BY ix_snapshot_system_ticktime`. The four current
   EDDN table reads already use system-name indexes and took 0.7–13 ms each;
   they were not the bottleneck in this sample. First fix the history query
   plan (a guarded index hint, or tested planner-statistics maintenance). Do not
   add redundant indexes blindly. Confirm index availability in every supported
   deployment before making a hint mandatory.

2. **Leaderboard join/filter indexes are missing.** Six candidate indexes on
   `market_buy_event(event_id)`, `market_sell_event(event_id)`,
   `mission_completed_event(event_id)`, `mission_failed_event(event_id)`,
   `commit_crime_event(event_id)` and `event(cmdr, tickid)` remove repeated
   scans/temporary automatic indexes. The same-snapshot tests above establish
   identical results and substantial query-time reductions. Exact candidate
   DDL is recorded in the measurements and prepared in
   `deploy/api-performance-indexes.sql`; it was subsequently applied during the
   rollout described above. All databases passed integrity checks.

3. **The original Flask startup used `serve(..., threads=1)`.** A slow SQL
   query or external call can hold up all other API requests. The dashboard's
   20-second fetch timeout includes time waiting in that queue. Increasing the
   thread count alone is unsafe: `set_tenant_db_config` assigns `db.session`
   globally and stores engines on Flask's request-local `g`, so engines are
   recreated on subsequent requests. First establish request-local tenant
   sessions, connection reuse per tenant and reliable teardown. Verify tenant
   isolation under concurrent requests before increasing concurrency. When
   considering multiple processes, also separate the schedulers started by
   `app.py` to avoid duplicate background jobs.

4. **Data explorer previously fetched every row for filter options and global search.**
   `loadExplorerRows` in `src/app/api/bff/[feature]/route.ts` reads 250 rows per
   request, in batches of six. With the production event count, just opening the
   event filter catalog needs 191 upstream requests, in addition to the visible
   page. Searching can trigger another complete scan. Flask also performs a
   `COUNT(*)` on every page. These waves contend with other users on a single
   worker, and the timeout resets for each page rather than bounding the whole
   operation. Replace the catalog scan with an authorized, tenant-scoped
   endpoint returning distinct commanders, event types and tick IDs. Move
   global search and its count to the backend, preserving JSON/text search
   semantics, sorting, exports and pagination. At this snapshot size, the
   catalog operation would go from 191 requests to one; the elapsed-time gain
   still needs measurement. Do not silently truncate the catalog or search.

5. **Leaderboard aggregation repeats work per commander.**
   `build_leaderboard_data` in Flask has correlated subqueries for missions,
   vouchers, exploration, influence and fines; monthly mode repeats the query
   per month. Use a representative current database to compare its query plan
   with per-commander aggregate CTEs joined once. Validate mission counts,
   influence compatibility, credits and month boundaries before replacing it.
   Add join/filter indexes only after examining the actual deployment schema.

6. **Alert retrieval previously had an N+1 query pattern.**
   `dashboard_bgs_alerts` in `bgs_rules.py` performs one notification-delivery
   query per returned alert, in addition to the count and alert-list queries.
   A 100-alert response therefore runs 102 queries in this handler. Batch the
   delivery lookup for the visible IDs while retaining pending/retry priority,
   most recent delivery selection and last successful delivery time.

7. **Client retries and abandoned work amplify congestion.**
   The previous default retried twice. Three 20-second upstream timeouts plus
   retry delays can keep one ordinary query pending for roughly a minute.
   Most primary page loaders did not consume React Query's abort signal, and
   the BFF discarded that signal when creating upstream requests.

## Changes implemented in this checkout

- Home, feature/evaluation and Data explorer loaders consume cancellation.
  Their BFF request clones retain it, and the Flask fetch combines it with its
  existing timeout. A cancelled explorer scan stops scheduling further pages.
  An HTTP disconnect does **not** guarantee cancellation of SQL already
  executing inside Flask; that requires backend support.
- These loaders preserve HTTP status in errors. They do not automatically
  repeat 4xx or gateway/unavailable/timeout (502/503/504) failures. Full-table
  explorer scans never automatically restart. The shared default allows one
  retry for other errors; existing explicit per-query overrides still apply.
  Manual refresh and existing scheduled refresh remain available.
- Search and page-size changes now fetch only the requested result page.
  The complete matching result is loaded only for explicit copy/export actions.
- Slow Flask requests (at least one second) and aborts emit structured timing
  logs with method, path and correlation ID, without credentials, query values
  or bodies. `Server-Timing` exposes upstream duration on ordinary proxied
  responses and individual home requests. It includes body parsing but excludes
  session verification and tenant configuration lookup; it is not total page
  latency. Full-table scan aggregates do not yet expose total timing.
- A timeout during body reading or malformed upstream JSON now fails the
  request instead of producing an apparently successful empty dashboard.

No shared response cache was added: tenant isolation, user-specific visibility,
revoked sessions and invalidation after writes must remain correct.

## Follow-up measurement opportunities

1. Observe timings by endpoint alongside queue length, CPU, disk I/O and SQLite
   lock waits during normal multi-user traffic.
2. Consider indexed full-text search if broad cross-field searches remain a
   common workload; retain literal Unicode/JSON search semantics.
3. Compare p50/p95 latency, timeout rate, query counts and response size before
   and after, under the same filters/data and simultaneous users. Check cold and
   warm runs separately. Only then set endpoint budgets or introduce carefully
   scoped caching. Increasing the 20-second timeout alone does not resolve
   queueing or redundant work.

No commits were created as part of this rollout; unrelated existing workspace
changes were preserved.

# Functional parity baseline

This inventory is based on the current local working trees of `EICStreamlitDashboard`, `EICFlaskServer` and `VALKDiscordBot`, including uncommitted work present when V2 was scaffolded.

| Existing Streamlit surface | V2 route | Refresh |
|---|---|---:|
| Home / reporting overview | `/` | smart |
| Leaderboard | `/analytics/leaderboard` | 5 min |
| Evaluations Full / Top 5 and Discord report | `/analytics/evaluations` | 5 min |
| Monthly Performance and AI assessment | `/analytics/monthly-performance` | 30 min |
| Cmdrs | `/analytics/commanders` | 5 min |
| Recruits | `/analytics/recruits` | 5 min |
| Redeem Vouchers | `/analytics/bounty-vouchers` | 5 min |
| Space / Ground CZ Summary | `/analytics/conflict-zones` | 5 min |
| Objectives | `/operations/objectives` | 5 min |
| Colonisation contributions / constructions | `/operations/colonisation` | 5 min |
| System Info (EDDN) | `/intelligence/systems` | 60 sec |
| 24h System / Faction Report | `/intelligence/factions-24h` | 60 sec |
| Table Viewer | `/admin/data-explorer` | manual |
| Diagnostics | `/admin/health` | 60 sec |

## Discord regression boundary

The web application does not duplicate bot-only commands. Smoke and contract tests in `VALKDiscordBot` remain the release gate for manual BGS capture (Activity, List Current Tick, Undo, Clear), system info/map/bodies/traffic/stations, system/commander/faction activity, faction conflicts, mining, exobiology, nearby searches, colonisation, `/my`, `/top5`, sync, diagnostics, health and icons.

## Comparison record

For each parity run, record tenant, role, route, filter URL, Streamlit result, V2 result, generated timestamp, tick ID and reviewer. A route is accepted only when values, grouping and filtering match on identical historical fixtures.

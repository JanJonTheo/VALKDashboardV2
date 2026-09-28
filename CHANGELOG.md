# Changelog

Changes to VALK Dashboard, listed in reverse chronological order. Dates and times use Europe/Berlin.

## 28.09.2026 - ANKe remote monitoring and control

- Prepared the current remote and API performance changes for GitHub, including the English changelog and deployment diagnostics. Release verification: all 209 unit tests and TypeScript checking pass.

- Added Operations → ANKe Remote for pairing clients, viewing explicitly shared Elite screens, and managing device access.
- Added optional exclusive keyboard/mouse control, remote assist start reviews and an always-visible remote stop action when control is enabled locally.
- Remote routes require authenticated sessions and same-origin mutations; media connections use a configured CSP origin. Added browser and boundary tests.
- Verified a paired Windows client with live Elite video in the production dashboard. Fixed HTTPS proxy origin checks and upstream API paths; the native build now loads runtime media settings so the deployed CSP permits LiveKit.

## 27.09.2026 - Reduce unnecessary API load and investigate timeouts

- Watchlist history uses the existing system/time index when available. Tenant leaderboard indexes avoid repeated full-table scans, and alert delivery information is loaded in one batch.
- Data explorer now loads a compact filter catalog in one API request and searches on the server with pagination, including literal Unicode and JSON-field searches. Complete downloads are reserved for explicit copy/export actions.
- Flask database sessions are isolated per request and reuse bounded tenant connection pools, enabling four API workers without mixing tenant data. Added concurrent isolation and rollback tests, and updated outdated conflict-display test expectations for release verification.

- Home, feature and Data explorer requests now propagate cancellation when users leave a view or change filters. Cancelled explorer scans stop requesting further pages.
- These views no longer automatically repeat authorization, rate-limit or gateway failures. Full-table explorer scans do not automatically restart after errors, reducing pressure on a slow API. Other queries use at most one default retry; explicit per-view settings remain in effect.
- Changing the page size of Data explorer search results reuses the downloaded results. Upstream body timeouts and malformed responses now surface as errors instead of apparently empty successful results.
- Deployed the backend changes, seven tenant indexes and the new dashboard release on 27 September. In production checks, the 86-system watchlist fell from about 5.7 seconds to 0.09–0.16 seconds; current-tick leaderboard requests fell from about 1.3 seconds to 0.06 seconds. These are individual measurements, not guaranteed response times.
- Verified 201 dashboard tests, 136 backend tests plus 31 subtests, 8 bot smoke tests and 41 browser checks (4 viewport-specific skips), along with builds, lint, actual logins for all three tenants and concurrent tenant isolation. Backups, rollback instructions and remaining broad-search limitations are documented in `docs/API-PERFORMANCE.md`.

## 24.09.2026 - Duplicate Discord notifications in VALK Development

- Corrected overlapping personal and tenant rule packages that sent the same events to the same Discord webhook. Conflict, influence-loss, below-5%, and 2 pp gap notifications now use the tenant package's Discord delivery; personal dashboard alerts remain enabled.
- Verified matching rule conditions and severity, identical webhook destinations, and no outstanding personal deliveries before applying the configuration change. Backed up the tenant database and verified database integrity and all eight rule settings afterward. No test messages were sent.
- This is a live tenant configuration correction; no application deployment was required. Details and rollback instructions are in `docs/DISCORD-DUPLICATE-REPAIR.md`.

## 12.09.2026 - Conflict graphics and English changelog

- Discord graphics for new conflicts and conflict updates now show each faction's Won Days and Stake in both the previous and alert snapshots. The image remains exactly 1000 x 285 pixels.
- Factions retain the same order across snapshots even when the source lists them in reverse order. Unknown scores remain distinct from zero. Long labels are abbreviated to fit; the accompanying Discord text retains the detailed values.
- Translated the complete dashboard and backend changelogs into English. Future entries are to be written in English.
- Validation: 13 graphics tests passed, including image dimensions, faction matching, reversed order, zero/missing scores, long labels and missing snapshots. A rendered example was visually checked.

- Deployment: graphics backend activated on 12.09.2026 at 03:26 CEST; installed source matches the tested file. The service is active and health checks pass for all three tenants. These changes have not yet been committed.

## 11.09.2026 - BGS alerts, conflicts and user administration

### Better conflict information

- BGS Alerts, Watchlist, Record Details and System intelligence details now show both factions' won days and affected stakes. Multiple simultaneous conflicts in a system appear separately. Missing values are shown as a dash.
- Conflict rules also track ongoing conflicts: each affected faction pair receives a warning with scores, status and stakes for every new settled system tick. Earlier warnings are resolved. Repeated evaluation of the same tick does not create duplicates.
- Updates cover the transition from pending to active and a reported conflict conclusion. No additional update is generated without new system data. The Rules Catalog explains this behaviour; existing conflict-type and delivery settings are preserved.
- Discord conflict messages also include scores and stakes. Existing alerts were supplemented with historical conflict details wherever an exact match was available.
- Gap warnings are suppressed for faction pairs already in a pending or active War, Civil War or Election. Nine redundant alerts were removed across tenants.

### Easier alert management

- After confirmation, admins can use "Mark all as read" for every alert visible to them in the current tenant, including alerts outside the current filters. **Only the admin's own read status changes. Alerts remain unread for other users.**
- The number of marked alerts appears beside the unread count with matching styling.
- Header actions use two rows: "60s refresh" and "Refresh" above "Mark all as read" and "Views".
- Users can resolve their own personal alerts or delete them after confirmation. Admins can resolve and delete shared alerts. The redundant "Acknowledge" action was removed; action buttons remain fully visible in narrow layouts.
- Resolved alerts are automatically removed after ten days. Re-evaluation does not recreate deleted events.

### User administration and display

- "Roles & permissions", to the left of "New user", opens a help page with a permissions matrix for Member, Leadership and Admin, including permissions for personal and shared alerts.
- The sidebar reliably shows the signed-in tenant's logo, falling back to tenant initials if the image cannot load.

### Documentation and operations

- Consolidated the change history. AGENTS.md requires a user-friendly changelog update with every commit.
- Removed obsolete server backups. Retained backups and cleanup scope are documented in the [backup inventory](docs/BACKUP-RETENTION.md).
- Features were checked with backend, component and browser tests, type checking, lint and production builds. The deployed service passed health checks for all three tenants.

Technical details: [alert management](docs/ALERT-HOUSEKEEPING.md), [gap warnings during conflicts](docs/CONFLICT-GAP-FIX.md), [conflict details and tick updates](docs/CONFLICT-UPDATES.md).

## 09.09.2026 - Compact Discord graphics and complete system data

- Graphic height adapts to the alert type. Single-faction alerts use 1000 x 240 pixels instead of 1200 x 576; differences appear next to arrows. Unused space is reduced without omitting comparison values.
- Incomplete historical system metadata falls back to the latest EDDN system record with an explicit data-source label. Population, allegiance, government and economy are available again; historical influence values remain unchanged.
- Labels standardised to "System Data", "Previous Snapshot" and "Alert Snapshot". RC, Inara, Spansh and EDGIS share the "System/Map Links" field.
- Validation: 46 backend tests passed; all graphic types were visually reviewed. Live metadata and population were checked for Tascheter Sector OY-R a4-0 without sending a Discord message.

## 09.09.2026 - Historical comparison graphics in Discord BGS alerts

Status: backend extension activated on 09.09.2026. The dashboard release was unchanged.

- Discord messages start with the system name and locally formatted alert time, followed by an embedded PNG, previous/alert snapshots, historical system data and system links.
- Deterministic graphics cover influence losses and changes, faction gaps, thresholds and conflicts. Loss graphics show previous influence, a red downward arrow, the percentage-point difference and influence at the trigger.
- New alerts store a versioned presentation context with their facts. Comparisons spanning multiple days are preserved; later delivery does not replace trigger values with live data. Existing alerts use stored facts and exactly matched historical snapshots. Missing or inconsistent values are not invented.
- Automatic and manual delivery use the same multipart image attachment. Text messages remain deliverable if rendering fails. No additional database table or public API is required.
- Validation: 43 backend tests passed, covering all graphic types, stored long-term comparisons, corrected snapshots, historical null lists, long names, Discord limits and rendering failures. Graphics and message structure were checked using an existing live alert without sending a Discord message.

## 08.09.2026 - Fully visible system information in alerts

Status: deployed on 08.09.2026 at 22:31 CEST. Release: `20260908-alert-row-fix`.

- The controller/system row previously allowed only 16-18 pixels for 22-pixel information chips. It now provides 24 pixels including padding. Footer spacing compensates for the extra room; overall height and faction cards remain unchanged.
- A regression test checks full visibility on desktop, tablet and phone. All three browser checks, lint, production build and type checking passed; public health returned HTTP 200. No backend restart was required.

## 08.09.2026 - Discord embeds and Alert Center

Status: deployed to [valk-elite.de](https://valk-elite.de) on 08.09.2026 at 22:19 CEST. Release: `20260908-discord-embeds`.

- Automatic and manually sent BGS alerts use the same Discord embed: linked system title, severity colour, status, and highlighted historical trigger value and threshold.
- Compact fields show only the relevant factions, with current influence, government, allegiance, active and pending states. System information, external links and separate timestamps complete the message. Missing current data does not prevent delivery.
- Native Discord formatting respects field limits, escapes Markdown and disables mentions. Existing delivery queues and retries are preserved. Previously sent messages are not modified.
- Dashboard heading standardised to "Alert Center".
- Validation: 36 backend tests with simulated Discord delivery passed, as did lint, production build and type checking. The live 39 Tauri alert's two factions and stored 1.87 pp gap were checked without sending a test message.
- Deployment-time backend backup: `/home/valk/dashboard-v2/shared/discord-embeds-backup-20260908/`. The previous dashboard release was retained at deployment.

## 08.09.2026 - Compact alert strips with faction context

Status: deployed on 08.09.2026 at 21:58 CEST. Release: `20260908-alert-faction-strips`.

- Alert cards reuse the Watchlist's system information and faction components. Only factions relevant to the alert are shown; single-faction alerts do not receive an artificial comparison partner.
- Trigger values and thresholds are highlighted and labelled as historical values. Faction cards show current data; the original message remains expandable. Missing influence is displayed as a dash.
- Card heights were set to 244 pixels on desktop/tablet and 394 pixels on phones, compared with the sample alert's previous 242.69 and 394.44 pixels. Faction cards can scroll horizontally on small screens.
- Record Details reflect the selected alert: affected faction rows receive an alert icon and short message, while matching history lines and legend entries are highlighted. Other factions remain visible. Watchlist details still open without alert highlights.
- Visible systems load in a batch, duplicate systems are combined, and results are shared with the detail view. Added a session-protected POST at `/api/system-watchlist/detail` for up to 100 systems, without backend or database-schema changes.
- Validation: 168 unit tests and 21 browser checks passed. Two existing unit tests exceeded their parallel timeout and passed in isolation. Card heights, keyboard access, faction selection and different alerts for one system were checked on desktop, tablet and phone. Type checking, lint and production build passed.
- Live checks using the existing jjt session confirmed system data, batch loading and faction matching for the stored 1.87 pp gap. No Discord test message was sent; the previous release was retained at deployment.

## 08.09.2026 - Alert system details and individual Discord delivery

Status: deployed on 08.09.2026 at 21:06 CEST. Release: `20260908-alert-actions`.

- Each card starts with a gold, clickable system name. It opens the Watchlist's Record Details panel, including influence history. Data loads on demand, independently of the personal Watchlist.
- Each alert has links to Raven Colonial, Inara, Spansh, EDGIS and Record Details. Long system names wrap fully on small screens.
- Leadership and Admin users can send a visible alert, including their own personal alert, to the tenant's BGS channel. Intentional resending is supported; unique request IDs and atomic queue entries prevent duplicates from double clicks or repeated requests.
- Delivery status, last successful delivery and errors are shown. Pending delivery refreshes every five seconds. Messages include system, alert text, severity, timestamps and status; read and acknowledgement states are unchanged.
- Validation: 31 backend tests, 160 dashboard unit tests and 18 browser checks passed, along with type checking, lint and production build. Delivery and retries used simulated Discord responses.
- Live checks confirmed alert metadata, the configured BGS webhook and system details. An invalid delivery request returned HTTP 400 without sending a message. The temporary EDDN database lock caused by startup maintenance had cleared by the final check.
- Deployment-time backup: `/home/valk/dashboard-v2/shared/alert-actions-backup-20260908/`. The previous dashboard release was retained at deployment.

## 08.09.2026 - Watchlist sectors, projects and external system links

Status: deployed on 08.09.2026 at 20:31 CEST. Release: `20260908-watchlist-labels-links`.

- Edit sector and project labels directly using the pencil icon. Personal labels remain user-specific; global and protected Watchlists share tenant-specific labels editable by Leadership and Admin users.
- Sector and project filters are available in all three Watchlists. Shared options come from the complete system list; filtering happens before pagination.
- Each system strip includes Raven Colonial, Inara and Spansh links. Spansh is resolved using the existing system cache when opened. Removed "Open Full System Information"; "Record Details" remains.
- On phones, actions appear below system information so names, sectors and projects stay readable.
- Validation: 157 unit tests and 32 browser checks passed, with four screen-specific cases intentionally skipped. Editing, filtering and accessible dialogs were checked on desktop, tablet and phone. Type checking, lint and production build passed. Public health returned HTTP 200; new endpoints without a session returned HTTP 401.

## 08.09.2026 - BGS package assignments and sparse snapshot evaluation

Status: deployed on 08.09.2026 at 20:01 CEST. Release: `20260908-bgs-alert-repair`.

- Catalog rules compare the latest available settled snapshots for each system, including gaps of several days. Window-based rules accept older comparison data and report the actual interval.
- Late or corrected snapshots are re-evaluated; unique alert IDs prevent duplicates. New packages retain their initial baseline behaviour.
- Empty catalog packages show "no rules" and can be restored. Deleting a package's last rule removes the empty backend assignment and refreshes the catalog.
- Added a repair script with read-only preview and mandatory backup. Restored two empty tenant packages with eight rules in total, plus the still-active personal gap alert for Preae Aihm DN-I c23-44, without resending historical Discord messages.
- Validation: 28 backend tests, 148 dashboard unit tests, nine browser checks, type checking and targeted lint passed. Local Turbopack and server Webpack builds passed. The repair ran twice on a database copy to verify duplicate prevention.
- Live evaluation checked 12 rules and 6,828 rule/system combinations. Personal and global evaluation states for the sample system were "ok"; the restored alert was active. Public health passed; unauthenticated rule access remained HTTP 401.
- Deployment-time backup: `/home/valk/dashboard-v2/shared/bgs-repair-20260908/`. The previous dashboard release was retained for rollback at deployment.

## 03.09.2026 - Consistent Evaluation details and period-specific Discord reports

Status: deployed on 03.09.2026 at 10:59 CEST. Release: `20260903-104316-evaluation-details-discord-period`.

- Evaluation details now use the same 15 columns in the same order as Leaderboard details.
- "Send Discord Report" passes the selected preset, custom dates or month range to the backend, preserving full and Top-5 reports.
- Incomplete custom periods disable sending and are rejected server-side instead of silently falling back to "All".
- Preference schema version 5 gives existing Evaluation views the complete default column selection once.
- The BGS alert list is keyboard-focusable in narrow layouts so its horizontal scroll area is accessible.
- Updated OpenAPI, generated types, unit and browser tests for column order and Discord payloads.
- Validation: lint, TypeScript, Linux production build, 146 unit tests and the full browser matrix passed: 29 successful checks and four intentional skips.
- Built the Linux release separately and checked it internally before switching. Public HTTPS, authentication, Better Auth, data parity, Evaluations, EDDN, Watchlist, user administration and preference smoke checks passed for all three tenants.
- Updated the Saved Views smoke test for schema version 5; temporary users, sessions, views and Watchlist data were cleaned up.
- Removed the previous dashboard release, uploaded deployment archive and staging leftovers after production verification.

## 03.09.2026 - Period and metric analysis for Evaluations

Status: deployed on 03.09.2026 at 01:27 CEST. Release: `20260903-012139-evaluation-period-metrics`.

- Added Leaderboard-style period and metric selectors, including custom date and month ranges. Visual Analysis switches between totals as bars and historical trends as lines.
- Added historical UTC windows for day, week, month, year, the last twelve months, Current Tick and Last Tick.
- Added a tenant-aware history API with twelve Leaderboard metrics, Top 10 in the full view and Top 5 in the compact view.
- Evaluation details follow the selected period independently of the selected metric.
- Preference schema version 4 includes chart type, period and metric in URLs and saved views.
- Validation: production build, 141 unit tests and Evaluation browser tests on desktop, tablet and phone passed.
- Built and checked the Linux release before switching; health, HTTPS, authentication, data parity and Evaluation history smoke tests passed.
- Removed old server dashboard releases, database/deployment backups and staging leftovers after production verification.

## 30.08.2026 - Consistent refresh controls and personal views

Status: deployed on 30.08.2026 at 23:20 CEST. At the time this entry was originally written, these changes had no separate Git commit and were based on `5bf927f` plus working-directory changes. Release: `20260830-saved-views-225358`.

- Added personal server-stored views for filterable Analytics and Operations pages, BGS Watchlist, BGS Alerts, Data Explorer and protected-faction administration.
- Depending on the page, views save search, filters, sorting, columns, page size, period, metric and presentation mode. Watchlist views also include the selected scope or protected faction.
- Save named views, restore, update, rename and delete them after confirmation. An indicator shows when the current view differs from its saved state.
- Up to 20 views per page and user, with names up to 64 characters and case-insensitive uniqueness. The existing backend limit of 16 KB per collection also applies.
- Added shared reset/refresh controls and a consistent Views menu.
- The previously inactive "Updated just now" button refreshes the current page and resets its view to defaults while retaining saved views. Local "Refresh" buttons reload data while preserving filters and sorting.
- Resetting or restoring a view handles relevant URL parameters and resets local pagination when needed. View state does not leak between feature pages; signing out clears the query cache.
- Working view settings are saved after a delay; explicit view actions save immediately. Writes are serialised. Save failures are visible; unconfirmed saved-view changes roll back while current working filters remain.
- Input entered before loading finishes is preserved when saved settings arrive.
- Preference schema version 3 stores the working view, active view ID and named views while continuing to read older single-view settings. Legacy Watchlist sorting is used as the initial state; watched systems remain separate from view preferences.
- The actual UTF-8 payload size, including its Flask envelope, is checked with a clear error above 16 KB.
- Added unit tests for view schema, page controls and API size limits; browser tests cover refresh behaviour and named views.
- Added `deploy/saved-views-smoke.py`, which removes temporary views and short-lived sessions without overwriting existing preferences.
- Validation: lint, TypeScript, Linux production build, 90 unit tests and relevant desktop/tablet/phone browser checks passed. Saving, renaming, resetting, restoring and deleting were verified over public HTTPS for all three tenants. User isolation was checked with multiple available test users in one tenant.
- Built and checked the release separately before switching; the previous release was retained for rollback. This deployment did not change Flask, Streamlit or the Discord bot.

## 30.08.2026, 16:43 - Correct faction rule catalog labels

Commit: [5bf927f - Fix protected faction catalog labels](https://github.com/JanJonTheo/VALKDashboardV2/commit/5bf927f445aefd4d192751ac59b1ce5b813277fd)

- Protected-faction conditions now say "Protected faction" instead of "Tenant faction" in the catalog and template editor.
- Added target-specific labels for influence loss, new conflicts, threshold breaches and approaching factions, while preserving tenant-faction labels.
- Added unit and browser coverage for target-specific wording.

## 30.08.2026, 15:12 - Visible faction webhook input

Commit: [568abbb - Show protected faction webhook input](https://github.com/JanJonTheo/VALKDashboardV2/commit/568abbb35ed3050ca4ce5e5f999c8b42547198e0)

- New or replacement Discord webhook URLs are visible while entered instead of masked as passwords. The field uses a URL input with spellcheck disabled.
- Stored webhook URLs are still never returned to the browser. Updated unit and browser tests.

## 30.08.2026, 14:42 - Faction autocomplete

Commit: [ac3e401 - Fix protected faction autocomplete](https://github.com/JanJonTheo/VALKDashboardV2/commit/ac3e4013aeb66dbf5c54c97388934a0304560ba5)

- Replaced the native suggestion list with a dashboard-styled EDDN autocomplete.
- Supports mouse selection, arrow keys and Enter, and closes on Escape or focus change. Added accessible combobox/listbox semantics and active selection.
- Loading and no-results states are visible; entering an exact faction name manually remains possible. Stale suggestions are hidden while the query changes.
- Updated suggestion and selection tests.

## 30.08.2026, 14:13 - Protected-faction administration

Commit: [e2375a0 - Add protected faction administration](https://github.com/JanJonTheo/VALKDashboardV2/commit/e2375a0b2d7e14d1ce4986dd1bbec5fcf5e78157)

- Added `/admin/protected-factions`, navigation and access checks. List, search, filter by active status, create and edit protected factions.
- Enter a faction name with optional EDDN suggestions, description and optional Discord webhook.
- Deactivation requires confirmation; permanent deletion additionally requires typed confirmation.
- Test stored webhooks without exposing their URLs; webhook management is write-only.
- Added protected API routes for administration, candidate lookup and webhook testing. Extended OpenAPI, generated types and permission, component and browser tests.

## 30.08.2026, 11:03 - Native deployment scripts

Commit: [32a93bc - Fix native deployment scripts](https://github.com/JanJonTheo/VALKDashboardV2/commit/32a93bc11e9271d389feac613b55d039634d4993)

- Marked `start-native.sh`, `ensure-native.sh` and `install-https-vhost.sh` executable in Git.
- Enforced LF endings for shell scripts using `.gitattributes` to prevent Windows/Linux compatibility problems.

## 30.08.2026, 10:56 - Protected-faction Watchlist

Commit: [f68c0d8 - Add protected factions watchlist](https://github.com/JanJonTheo/VALKDashboardV2/commit/f68c0d8ece475fbb103fb5661987b4e71ac444f8)

- Added protected factions as a BGS Watchlist scope, with faction selection, a protected system-data API, filtering, sorting and pagination.
- Extended the Rules Catalog with the `protected_faction` target. Early-warning packages can target a protected faction, with package/rule assignments reflected in the interface.
- Extended OpenAPI and generated types for protected Watchlists and rule targets; added API, component, catalog and browser tests.

## 30.08.2026, 05:10 - BGS warnings in the Command Center

Commit: [98c259c - Add BGS alerts to command center](https://github.com/JanJonTheo/VALKDashboardV2/commit/98c259c6e091426620c91b17f6fe4e74e73fb811)

- The home page shows active personal and tenant-wide warnings with severity, time, system, rule and read status, plus active/unread counts and a link to the full alert list.
- Added loading, error and empty states, automatic refresh and a shared BGS alert client.
- Adjusted Command Center layout and activity charts; extended browser tests.

## 30.08.2026, 03:56 - Intelligence, Command Center and expanded analytics

Commit: [3cc8c85 - Expand dashboard intelligence and command center](https://github.com/JanJonTheo/VALKDashboardV2/commit/3cc8c8598bba2c8133922367dd03579c0fb820ce)

### Command Center

- Combined home-page metrics and commander activity from Leaderboard data: influence, bounty vouchers, exploration sales, combat bonds and trade volume.
- Activity charts include exact contributions and percentages, handling empty or invalid totals.
- Added the last galaxy tick, estimated next tick and countdown, including overdue status. The estimate uses a 24-hour interval.
- Extended navigation, responsive layout and demo data.

### BGS Watchlist, rules and alerts

- Added a global Watchlist based on systems containing the tenant faction, with server-side filtering, sorting and pagination.
- Added statistics and richer system/faction information with stable faction colours and superpower icons.
- Manage personal and tenant-wide rules for systems or Watchlists, including thresholds, time windows, severity and notification destinations.
- View, manage, apply and synchronise rule templates/packages for influence changes, gaps and conflicts.
- Integrated an Alert Center with filters and persistent processing state.
- Added BGS AI risk/strategy reports with appropriate permissions and longer API timeouts.
- Manage and test personal Discord webhooks from the account page; personal and tenant-wide destinations are validated separately.
- Added permissions for personal rules, tenant rules and BGS AI.

### Colonisation

- Expanded Contributions, Constructions, commodity grouping and chronological Contribution Events.
- Added commander/commodity multi-selection and system, status and date filters, with visible active filters and sorting controls.
- Nested groups expand independently. Improved sorting, copying, completion indicators, quantities and differences.
- Aggregates duplicate contributions and unmatched deliveries without double-counting existing events. Total requirements and construction sums remain consistent when filtering.
- Added visual Top 5, Top 10 and Top 25 analysis and selection based on recent events.

### Data Explorer and technical additions

- Added a standalone Data Explorer with selectable tables and `event` as the default.
- Supports legacy commander, event, tick ID, colonisation and date filters, full-text search, server-side sorting and page size.
- Added JSON record details and CSV export of selected records, with horizontal/vertical scrolling and touch support.
- Added a clipboard fallback, an EDDN faction-metadata backfill script and runtime configuration.
- Extended OpenAPI, generated types, normalisation, demo data, live authentication/data-parity checks, and unit, component, browser and accessibility tests.

## 29.08.2026, 03:22 - First complete dashboard implementation

Commit: [b460a58 - Build tenant-aware VALK Dashboard V2](https://github.com/JanJonTheo/VALKDashboardV2/commit/b460a58f53df2f9cb03c464ff084bc96422d64ff)

### Application and presentation

- Set up Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 and Radix-based UI components.
- Built a responsive VALK design with app shell, navigation, sign-in, account page, metadata, manifest and OpenGraph image.
- Integrated TanStack Query, TanStack Table and ECharts with tabular chart alternatives. Added a demo mode with sample data and different user roles.

### Features

- Built the home-page report overview and metrics.
- Added Leaderboard, Evaluations with full/Top-5 views and Discord reports, Monthly Performance with AI assessment, Commanders, Recruits, redeemed bounty vouchers and space/ground Conflict Zones.
- Added period/date/month and domain-specific filters, metric selection, tables/charts, sorting and per-user view settings.
- Implemented validated Objectives and Colonisation contributions, constructions, grouped commodity/commander views and progress indicators.
- Integrated EDDN system information and 24-hour faction reports.
- Built a personal system Watchlist with favourites, sector/project labels, sorting, filtering, influence history and faction/conflict details.
- Connected station data, system maps and detail views through dedicated API routes. Added initial Data Explorer, service/audit views and user administration.

### Sign-in and security

- Connected existing tenant-local username/password authentication to Flask, including tenant selection and remembered choices.
- Added signed HttpOnly sessions lasting twelve hours and Member, Leadership and Admin roles.
- Set up a same-origin backend-for-frontend with server-side tenant API-key and database resolution.
- Added user creation, role changes, locking/unlocking, deletion and password resets, including one-time passwords and mandatory password changes.
- Added account profile, password change and access overview.
- Prepared Better Auth for explicitly linked Google/Discord accounts per tenant, without social self-registration or automatic linking by matching email. Included session transfer and encrypted provider tokens.
- Added security headers, request-origin checks and safe public-URL configuration. Tenant keys and provider secrets stay server-side.

### Operations, contracts and tests

- Added native Node.js startup and health scripts, runtime configuration, SQLite runtime checks and nginx/HTTPS setup.
- Included Dockerfile and Compose as additional repository artifacts; documented native deployment.
- Added Watchlist-seeding, runtime-configuration and production checks for authentication, user administration, data parity and preferences.
- Introduced OpenAPI 3.1 and generated TypeScript types.
- Set up ESLint, Vitest, Testing Library, Playwright and axe-core with desktop, tablet and phone profiles.
- Added README, configuration example, development instructions, parity inventory and deployment/rollback documentation.
- Documented parallel operation with Streamlit and the separate Discord bot's unchanged responsibilities as integration boundaries.

## 29.08.2026, 03:19 - Initial repository

Commit: [c11adc9 - Initial commit](https://github.com/JanJonTheo/VALKDashboardV2/commit/c11adc9c38be7f49db1ac551cde2498ce12a32de)

- Initialised the repository with GNU General Public License version 3.
- No application code yet; it followed in `b460a58`.

## Maintenance

- Update this changelog in English with every commit, under the current date, using clear language for users. Include features, fixes, documentation, security, compatibility, operations and relevant validation.
- Record verified Git references and deployment status when available. Clearly identify deployed changes that have not yet been committed, then add their reference when it exists.
- Do not include credentials or internal secrets. Do not equate commit times with deployment times. Mention other repositories only when their changes are verified and part of the release.
- Backup paths in historical entries describe the deployment-time state, not guaranteed current availability. See the [backup inventory](docs/BACKUP-RETENTION.md) for the cleanup performed on 11.09.2026.

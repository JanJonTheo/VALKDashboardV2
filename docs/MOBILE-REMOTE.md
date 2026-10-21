# Mobile ANKe Remote

Open `/remote` in the same dashboard installation. Authentication and device access
are shared with the dashboard. Operations → ANKe Remote links to the mobile view;
pairing and permission management remain on that existing page.

## Use

1. Select an online ANKe client. Opening the screen joins the existing LiveKit session.
2. Select **Panels** or **Flugsteuerung**, then **Manuelle Steuerung**. ANKe stops
   running assists and completes its existing manual input handoff before touch keys enable.
3. Tap panel focus, menu arrows, selection, back, and previous/next tabs. Hold flight
   axes while moving; release or slide outside the button to stop that input.
4. Select **Assistenten**, take assist control, select an assist and request its
   start review. Check every required item and confirm before the review expires.
5. **Freigeben** ends control. **STOP / Nullschub** requests assist stop/zero throttle
   independently of holding an assist lease; successful execution is confirmed by ANKe.

Only one touch action is active at a time to prevent modifiers from unrelated
bindings from combining. Mouse steering, a virtual text keyboard and offline
control are outside this version. A real connection is required. This route is a
browser application; a separately installable PWA manifest/service worker is not included.

## Companion changes and rollout

The implementation spans three local repositories:

- `VALKDashboardV2`: `/remote`, shared remote viewer, touch controls and mobile login destination.
- `EDAPGui-ANKe`: `EDRemoteBindings.py` publishes a bounded set of actions using
  the scan codes already resolved by `EDKeys`, including modifiers and the game's
  keyboard layout. Panel focus/previous-tab bindings are optional. Numpad and ISO
  keyboard inputs are supported by the existing Windows input adapter.
- `EICFlaskServer`: validates and forwards optional `status.input_bindings` through
  the existing authenticated device/viewer routes. Invalid binding updates do not
  replace the last valid status.

API and dashboard were deployed on 21 October 2026. The current release is
`/home/valk/dashboard-v2/releases/20261021-mobile-remote-124704`. The local source
installation at `C:\Users\Shadow\PycharmProjects\EDAPGui-ANKe` was restarted;
the paired **ANKe** device is online, with remote control already enabled and
all 28 touch actions published. Another paired device, **Shadow-PC**, still reports
no input bindings and needs its own client update before using touch controls.

For future rollouts, update the API, dashboard and ANKe client together, then restart ANKe. No database
migration, new account or new pairing is needed. After changing Elite key bindings,
restart ANKe so its existing binding loader reads the new configuration. Older
clients still support viewing and assist actions, while touch controls stay disabled
instead of assuming default keys. The existing lease, sequence, freshness,
foreground and local watchdog checks apply to all touch-generated input packets.

## Verification

Current fix rollout: `20261021-remote-reconnect`. Reports, API backups and database
snapshots are in `/home/valk/dashboard-v2/shared/20261021-remote-reconnect`.
The full dashboard suite, final 22 viewer regression tests, 15 browser checks,
164 backend tests plus 31 subtests and 27 Linux companion tests passed. All 30
public HTTPS checks passed after the archive-retention fix; sampled control/API
requests completed in 35–123 ms. Shadow-PC reported live capture and all 28 actions.
No real input or assist start was sent by verification. Rollback restores both
`remote_screen.py` and `anke_data.py` from `backend-before`, restarts `valkflask`,
and switches the dashboard to `20261021-mobile-navigation`; database restoration
is unnecessary and would overwrite newer activity.

Manual control pauses during brief video replacements, reconnecting media or stale
frames. All held input is cleared immediately; only neutral state heartbeats retain
the existing lease. Fresh video resumes controls within an eight-second grace period.
No key-down is replayed. Release, backgrounding, permission loss, failed input channels
or a longer interruption still end control. The dashboard never automatically
acquires a new lease after server/client revocation. The companion API reads bounded
upload bodies outside its session lock so slow uploads cannot stall heartbeats.

The dashboard also provides **Operations → Mobile Remote**, both in its desktop
sidebar and its mobile navigation drawer. It opens `/remote` directly; the existing
ANKe Remote entry continues to provide pairing, sharing and diagnostics.

Navigation rollout on 21 October: release `20261021-mobile-navigation`, with build,
activation and public verification reports in
`/home/valk/dashboard-v2/shared/20261021-mobile-navigation`. Its dashboard rollback
target is `20261021-mobile-remote-124704`; the compatible API is unchanged and its
three companion modules match the local source checksums. For dashboard rollback,
restore the previous `current` symlink, stop the new process after verifying its
PID/CWD, and run the previous release's `deploy/ensure-native.sh`.
All 30 follow-up public HTTPS checks passed, including the authenticated navigation
link. Both real paired devices, ANKe and Shadow-PC, report all 28 touch actions and
all six panel/tab bindings. Their capture state was idle during this read-only
check; no real game input or assist was started.

Verification on 21 October 2026: all 242 dashboard unit/integration tests, TypeScript,
ESLint and production build passed. The dedicated Chromium/WebKit browser matrix
passed all 15 checks. ANKe's remote, confirmation, keyboard-layout and key-timing
checks passed all 56 tests; the Flask remote-screen suite passed all 12 tests.
An unauthenticated request to the production build's `/remote` route returned
the expected redirect to `/sign-in?next=/remote`.

The unit/integration tests exercise all panel actions and custom modifier chords,
automatic key release, handoff readiness, focus movement within the viewer,
switching to assist control, required confirmations, review expiration, late
responses, view-only access, stale video, lost input channels and access revocation.
ANKe tests also pass published panel chords through the real `InputGate` with a
recording emitter, without sending Windows/game input.

Browser layout tests check touch target sizes, no horizontal overflow, panel and
flight tabs, assist access, unavailable connections, offline clients and the existing
dashboard pairing/sharing flow. Use:

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install chromium webkit
pnpm exec playwright test --config playwright.remote.config.ts --workers=2
```

The dedicated browser matrix includes Chromium desktop/phone and WebKit iPad
portrait/landscape and iPhone profiles. Media/API failures are mocked in browser
layout tests; live video/input and assist confirmation are mocked at the transport
boundary in component integration tests. These checks do not establish real iPad
hardware, Safari media decoding, TURN connectivity or actual game behavior.

Deployment validation also passed all 12 remote API tests in the server's Linux
runtime, its native Webpack production build and 29 public HTTPS checks. The public
checks used a short-lived session and an isolated synthetic device for the
manual/assist lease switch, review delivery, confirmed start acknowledgement and
stop acknowledgement; all temporary session/device records were removed afterward.
The existing real ANKe device was read only. No game input or real assist start
was sent. Backups, checksums, activation and verification reports are retained in
`/home/valk/dashboard-v2/shared/mobile-remote-20261021-124704`.

Rollback: restore `backend-before/remote_screen.py` from that staging directory,
restart the existing `valkflask` service, and restore the dashboard `current`
symlink to `/home/valk/dashboard-v2/releases/20261020-anke-data`. Stop the new
dashboard process after checking its PID/CWD, then run the previous release's
`deploy/ensure-native.sh`. Application rollback does not require restoring the
SQLite snapshot over newer user activity.

Before game acceptance, use a real iPad against the updated client while
docked in a harmless Elite menu. Verify each panel, both tab directions, selection,
back, a held key's release, app switching, reconnecting and the complete assist start
review with a suitable local configuration. Elite was not running on this Windows
machine during deployment; start Elite first and restart ANKe so the existing
window detection initializes correctly. Real iPad/Safari/game acceptance remains
outstanding after this deployment.

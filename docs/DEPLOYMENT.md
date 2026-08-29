# Native deployment and rollback

## Request boundary

```text
Browser ── tenant/username/password once ───> Next.js login BFF ──> Flask /api/login
Browser ── signed HttpOnly session ─────────> Next.js BFF ── tenant API key ──> Flask tenant API ──> tenant database

VALKDiscordBot ── legacy apikey + apiversion ─────────────────────> Flask tenant API
Streamlit       ── legacy apikey + apiversion ─────────────────────> Flask tenant API
```

The login flow uses the existing tenant-local username and password. The browser selects a public tenant ID; Next.js resolves that ID against the server-side `tenant.json` and sends the corresponding API key only on the server-to-server hop. Tenant API keys are never entered by users, stored in the session cookie, or exposed by dashboard data routes.

The login page defaults to `valk-development`. A user-selected tenant ID is remembered for one year in the non-sensitive `valk_login_tenant` preference cookie and is accepted only when it still matches a configured tenant.

Discord OAuth, guild membership and Discord-role refresh are postponed. Existing `is_admin` users map to `admin`; other active users map to `member` until that phase resumes.

## Port 8889 deployment

The production instance runs directly with Node.js, without Docker or another container runtime. Runtime settings are stored in a mode-600 `.env.runtime`; the existing Flask tenant file and Streamlit asset directory remain the sources for database routing and tenant logos. `deploy/start-native.sh` starts Next.js on `0.0.0.0:8889`; `deploy/ensure-native.sh` performs an idempotent health check before starting it.

On hosts where the deployment user cannot install a root systemd unit or enable lingering, an `@reboot` user crontab entry invokes `ensure-native.sh`. The current release is also started immediately with the same script.

## Release gates

- Run lint, type checks, unit tests, production build and three-viewport Playwright tests.
- Verify `/api/health` reports every configured tenant database reference.
- Exercise `/api/login` against every configured tenant without logging credentials or API keys.
- Run Flask contracts and existing Discord bot smoke tests.
- Keep Streamlit available on port 8888 during the parity period.

## Rollback

Stop the port-8889 process and remove only the V2 `@reboot` entry. Streamlit, Flask, their tenant configuration and the Discord bot remain untouched.

# VALK Dashboard V2

Responsive Next.js command dashboard for the existing multi-tenant VALK Flask API. It replaces the Streamlit user interface in a controlled parallel rollout; `VALKDiscordBot` remains an independent, unchanged Discord channel.

## Included

- Next.js 16 App Router, React 19, strict TypeScript and Tailwind CSS 4
- VALK dark design system with shadcn-style Radix primitives
- TanStack Query smart refresh and TanStack Table v9
- Apache ECharts with a tabular accessibility alternative
- React Hook Form + Zod objective validation
- Existing Streamlit-compatible username/password/API-key sign-in against Flask
- Tenant-local, explicitly linked Google and Discord sign-in without social sign-up or implicit account linking
- Signed 12-hour HttpOnly sessions; existing admins map to Admin and other users to Member
- Same-origin BFF; tenant API keys are resolved from the server's existing tenant file after login
- Analytics, Operations, Intelligence and Administration routes from the parity inventory
- Native Node.js deployment, OpenAPI 3.1 generated types, Vitest, Playwright and axe-core

## Local development

The app intentionally starts in a local demo session when `NODE_ENV` is not production and `VALK_DEMO_MODE` is not explicitly `false`.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Set `VALK_DEMO_ROLE=member`, `leadership` or `admin` to test permissions.

## Production configuration

1. Copy `.env.example` to `.env.runtime` and replace the session secret.
2. Point `VALK_TENANT_FILE` at the existing Flask tenant file and `VALK_TENANT_LOGO_DIR` at the Streamlit assets.
3. Install dependencies and run `pnpm build` with `VALK_DEMO_MODE=false`.
4. Start `deploy/start-native.sh`; the production server binds to port 8889 by default.

Classic Streamlit-compatible sign-in remains the bootstrap method. An administrator creates only the username and role; the user signs in once with the generated one-time password, changes it, and can then link Google and/or Discord from the Account page. The verified provider email, avatar and provider account ID are stored automatically in that tenant database. Unlinked social accounts cannot sign in and social sign-up and implicit email linking remain disabled.

Enable the providers with `VALK_SOCIAL_AUTH_ENABLED=true` and the matching `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`. The server passes only the list of configured providers to the UI; provider secrets remain server-only. Register a callback per tenant, for example `https://valk-elite.de/api/auth/valk-development/callback/discord`. Provider tokens are encrypted server-side and are never returned to the browser.

## Quality commands

```bash
pnpm api:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright runs at the required `1440×900`, `1024×768` and `390×844` viewports. The Data Explorer never polls automatically; smart refresh pauses when the tab is inactive through TanStack Query.

## Parallel rollout

Use a separate route or subdomain for V2, compare identical filters and historical fixtures with Streamlit for at least 14 days and multiple BGS ticks, then switch the public link. Retain the Streamlit container and configuration for 30 days as a rollback. See [docs/PARITY.md](docs/PARITY.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

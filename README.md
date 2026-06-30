# Soverm

**Soverm** is an AI personal CFO: connect bank accounts via Plaid, sync transactions, generate Claude-powered financial insights, follow up in per-insight chat, and track action items. Auth is handled by Clerk; data is stored in PostgreSQL.

The product name is **Soverm** (see `client/index.html` and the landing page at `/`).

Production: [soverm.vercel.app](https://soverm.vercel.app) (client) + Railway (API).

## Tech stack

| Layer | Stack |
|-------|--------|
| Client | React 19, Vite, Tailwind CSS, React Router, TanStack React Query, Clerk, react-plaid-link, PostHog + Sentry (optional) |
| Server | Node.js, Express 5 (ES modules), PostgreSQL (`pg`), Plaid SDK, Anthropic SDK, Clerk, Svix (webhooks), node-cron, Sentry (optional) |

The client calls the API with `fetch`.

## Project structure

```txt
cfo-agent/
├── client/                 # Vite React app (deployed to Vercel)
│   └── src/
│       ├── components/
│       ├── context/
│       ├── lib/
│       └── pages/
├── server/                 # Express API (deployed to Railway)
│   ├── routes/             # API route handlers
│   ├── services/           # Plaid, Claude integrations
│   ├── utils/              # Usage limits, rate limits, Sentry, shared helpers
│   ├── db/
│   │   ├── schema.sql      # Bootstrap schema for a fresh database
│   │   └── migrations/     # Incremental SQL migrations (001–007)
│   ├── scripts/            # Migration runners and verification helpers
│   └── index.js
└── shared/                 # Constants shared by client + server (usage limits, pricing)
```

## Features (current)

- **Auth** — Clerk sign-in; `POST /webhooks/clerk` syncs new users to Postgres
- **Bank linking** — Plaid Link via `/api/plaid/*`: link token, exchange token, sync transactions, disconnect account
- **Dashboard** — Balances, spending by date range, latest insight, usage badge, onboarding empty state
- **Insights** — Claude-generated summaries (`POST /api/insights/generate`); free tier: 1/day; Pro: unlimited (paywall UI; Stripe not wired yet)
- **Chat** — Follow-up Q&A per insight (`GET` / `POST /api/chat/:insightId`), hourly rate limit
- **History** — Past insights; free tier sees last 7 days
- **Actions** — Checklist items tied to insights (`GET /api/actions`, `PATCH /api/actions/:id`)
- **Settings** — Plan/usage, disconnect banks, permanent account deletion (`DELETE /api/user`)
- **Landing** — Public homepage with pricing and security FAQ
- **Legal** — `/privacy` and `/terms` (placeholder pages today)

## Environment variables

Never commit real secrets. Use `.env` locally and your host’s dashboard in production. **Variable names only below — never paste real values into the repo.**

### Client (`client/.env`)

Copy `client/.env.example` to `client/.env`. Only `VITE_*` variables are exposed to the browser.

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend auth |
| `VITE_API_URL` | Yes | Express API base URL (no trailing slash) |
| `VITE_POSTHOG_KEY` | No | PostHog analytics (omit to disable) |
| `VITE_POSTHOG_HOST` | No | PostHog ingest host |
| `VITE_POSTHOG_SESSION_RECORDING` | No | Set to `true` to enable session replay |
| `VITE_SENTRY_DSN` | No | Sentry browser DSN (omit to disable) |

There are **no client-side Plaid env vars** — Plaid credentials live on the server. The client loads Plaid Link from the CDN (`client/index.html`) and receives short-lived link tokens from the API.

> **Note:** This codebase uses `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`, not `VITE_PUBLIC_POSTHOG_*`.

### Server (`server/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend auth |
| `CLERK_PUBLISHABLE_KEY` | Yes | Used by `@clerk/express` middleware |
| `CLERK_WEBHOOK_SECRET` | Yes | Verify Clerk `user.created` webhooks |
| `PLAID_CLIENT_ID` | Yes | Plaid API |
| `PLAID_SECRET` | Yes | Plaid API |
| `PLAID_ENV` | Yes | `sandbox` or `production` |
| `ANTHROPIC_API_KEY` | Yes | Claude insights + chat |
| `ALLOWED_ORIGINS` | Yes | Comma-separated browser origins for CORS (no wildcards). Example: `https://soverm.vercel.app,https://soverm-git-main-you.vercel.app,http://localhost:5173` |
| `SENTRY_DSN` | No | Sentry Node DSN for server error alerts (omit to disable) |
| `PORT` | No | Listen port (default `5000`) |

`NODE_ENV=production` on Railway hides dev-only routes (`/test-db`, `/protected`, `/sentry-test`).

Client and server use **separate Sentry projects** (`VITE_SENTRY_DSN` vs `SENTRY_DSN`).

## Local development

### 1. Install dependencies

Use two terminals — install in both packages:

```sh
cd server && npm install
cd client && npm install
```

### 2. PostgreSQL setup

Create a local database and set `DATABASE_URL` in `server/.env`.

**Fresh local database** — current `schema.sql` already includes several later migrations (Clerk text IDs, `plaid_items`, `subscription_tier`, etc.). Bootstrap with:

```sh
cd server
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/migrations/002_create_actions_table.sql
psql "$DATABASE_URL" -f db/migrations/004_allow_null_account_id.sql
psql "$DATABASE_URL" -f db/migrations/006_create_chat_messages.sql
```

**Incremental migrations** (`server/db/migrations/`) for upgrading older databases, in order:

| File | Purpose |
|------|---------|
| `001_clerk_user_ids.sql` | Clerk string user IDs |
| `002_create_actions_table.sql` | Action items table |
| `003_add_last_synced_at.sql` | Sync timestamp on accounts |
| `004_allow_null_account_id.sql` | Nullable `transactions.account_id` |
| `005_create_plaid_items.sql` | `plaid_items` table + backfill |
| `006_create_chat_messages.sql` | Per-insight chat messages |
| `007_add_subscription_tier.sql` | `users.subscription_tier` |

There is also `add_plaid_cursor.sql` for legacy DBs that predate cursor columns in `schema.sql`.

Do **not** run `001`–`007` blindly after a fresh `schema.sql` — several steps (e.g. `003`, `005`, `007`) will fail because those changes are already in `schema.sql`.

### 3. Configure env files

- `server/.env` — server variables listed above; include `http://localhost:5173` in `ALLOWED_ORIGINS` for local frontend → API requests
- `client/.env` — copy from `client/.env.example`; set `VITE_API_URL` to match the server port

### 4. Start dev servers

**Terminal 1 — API**

```sh
cd server
npm run dev
```

**Terminal 2 — client**

```sh
cd client
npm run dev
```

- API health: `GET http://localhost:5000/` → `{ "message": "CFO Agent API is running" }` (override port with `PORT` in `server/.env`)
- Client: Vite dev server (default `http://localhost:5173`)
- On server startup in dev you should see `[Sentry] enabled` when `SENTRY_DSN` is set

`npm run dev` in `server/` runs `node --import ./instrument.js index.js` (Sentry initializes before Express loads).

## Deploy

### Client — Vercel

1. Import the repo; set **Root Directory** to `client`.
2. **Build command:** `npm run build` (default)
3. **Output directory:** `dist` (Vite default)
4. Set environment variables in Vercel (`VITE_*` — inlined at build time):
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL` → your Railway API URL
   - Optional: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_SESSION_RECORDING`, `VITE_SENTRY_DSN`
5. `client/vercel.json` rewrites all paths to `index.html` for client-side routing (`/dashboard`, `/privacy`, etc.).

Redeploy the client after changing any `VITE_*` variable.

### Server — Railway

1. Deploy the `server` directory (monorepo: set root path to `server`).
2. **Start command:** `npm start` → `node --import ./instrument.js index.js`
3. Attach a Railway Postgres plugin; use its `DATABASE_URL` in service variables.
4. Set all server env vars listed above. For `ALLOWED_ORIGINS`, use a comma-separated list of every frontend origin that should call the API: your Vercel production URL, each Vercel preview URL you use (they change per branch/PR), and `http://localhost:5173` if you test locally against Railway. Do not use `*`. Add `SENTRY_DSN` for API error alerts.

### Database migrations (manual)

Migrations are **not** applied automatically on deploy. SQL files live in `server/db/migrations/`.

**Idempotent Node runners** (safe to re-run; only apply 006 and 007):

```sh
cd server
DATABASE_URL='<railway-postgres-url>' node scripts/run-006-chat-migration.js
DATABASE_URL='<railway-postgres-url>' node scripts/run-007-subscription-tier-migration.js
```

**Verify or apply on production:**

```sh
DATABASE_URL='<railway-postgres-url>' node scripts/verify-migrations.js
DATABASE_URL='<railway-postgres-url>' node scripts/verify-migrations.js --apply
```

These scripts **do not** call `dotenv.config()` or `import 'dotenv/config'` — you must pass `DATABASE_URL` in the shell (or export it from `server/.env` yourself). Use the **public** `DATABASE_URL` from Railway’s Postgres **Connect** tab for production.

`verify-migrations.js` refuses localhost unless `ALLOW_LOCAL_DB=1`.

## API routes (summary)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check |
| `GET` | `/sentry-test` | Dev-only Sentry test (non-production) |
| `POST` | `/webhooks/clerk` | Clerk user sync |
| `POST` | `/api/plaid/create-link-token` | Plaid Link token |
| `POST` | `/api/plaid/exchange-public-token` | Save linked accounts |
| `POST` | `/api/plaid/sync-transactions` | Sync transactions |
| `DELETE` | `/api/plaid/accounts/:accountId` | Disconnect bank account |
| `GET` | `/api/insights/usage` | Daily usage / tier |
| `POST` | `/api/insights/generate` | Generate AI insight |
| `GET` | `/api/dashboard/summary` | Dashboard data (`?range=` query) |
| `GET` | `/api/actions` | List action items |
| `PATCH` | `/api/actions/:id` | Update action (e.g. completed) |
| `GET` | `/api/history` | Insight history |
| `GET` | `/api/chat/:insightId` | Chat messages for an insight |
| `POST` | `/api/chat/:insightId` | Send chat message |
| `DELETE` | `/api/user` | Delete account and all data |

Dev-only when `NODE_ENV !== 'production'`: `GET /test-db`, `GET /protected`.

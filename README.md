# Soverm

**Soverm** is an AI personal CFO: connect bank accounts via Plaid, sync transactions, generate Claude-powered financial insights, analyze expenses, track spending caps and savings goals, project cash flow, and follow up in chat. Auth is handled by Clerk; data is stored in PostgreSQL.

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
│   ├── services/           # Plaid, Claude, trackers, notifications
│   ├── utils/              # Usage limits, rate limits, forecast, helpers
│   ├── db/
│   │   ├── schema.sql      # Bootstrap schema for a fresh database
│   │   └── migrations/     # Incremental SQL migrations (001–018)
│   ├── shared/             # Constants shared with the client
│   ├── scripts/            # Migration runners, verify, unit tests
│   └── index.js
└── .github/workflows/ci.yml
```

## Features (current)

- **Auth** — Clerk sign-in; `POST /webhooks/clerk` handles `user.created`, `user.updated`, and `user.deleted`
- **Bank linking** — Plaid Link via `/api/plaid/*`: link token, exchange, sync (with partial-failure status), disconnect
- **Dashboard** — Balances, spending ranges, Needs Attention, Quick Tools (recent / trackers / forecast), usage badge
- **Insights** — Claude summaries (`POST /api/insights/generate`); free: 1/day; Pro: unlimited (Stripe Checkout when configured)
- **Expense Analyzer** — Categories, recurring charges, MoM, optional Claude narrative (`/expense-analyzer`)
- **Trackers** — Monthly spending cap + savings goals, custom alert thresholds, savings-transfer confirm/dismiss
- **Cash-flow forecast** — 30-day projection (`GET /api/dashboard/forecast`)
- **Proactive notifications** — In-app alerts after sync (large txn, low balance, recurring, spike, spending-cap)
- **Before you spend** — Optional Quick Tools check: fine / soft-limit / rent / payday judgment before a purchase
- **Weekly truth letter** — Sunday email + in-app alert (3 bullets → Your week; dry-run until `RESEND_API_KEY` + `MAIL_FROM`)
- **Month-end letter notify** — Day-1 email + in-app alert when the prior month’s accountant letter is ready
- **Chat** — Follow-up Q&A per insight, plus general chat without an insight (`/api/chat/general`)
- **History** — Past insights; free tier sees last 7 days
- **Actions** — Checklist items tied to insights
- **Settings** — Plan/usage, Pro upgrade, notification prefs, disconnect banks, account deletion
- **Landing / legal** — Public homepage; real `/privacy` and `/terms`

## Environment variables

Never commit real secrets. Use `.env` locally and your host’s dashboard in production.

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

There are **no client-side Plaid env vars** — Plaid credentials live on the server.

### Server (`server/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend auth |
| `CLERK_PUBLISHABLE_KEY` | Yes | Used by `@clerk/express` middleware |
| `CLERK_WEBHOOK_SECRET` | Yes | Verify Clerk webhooks |
| `PLAID_CLIENT_ID` | Yes | Plaid API |
| `PLAID_SECRET` | Yes | Plaid API |
| `PLAID_ENV` | Yes | `sandbox` or `production` |
| `ANTHROPIC_API_KEY` | Yes | Claude insights + chat + narratives |
| `ALLOWED_ORIGINS` | Yes | Comma-separated browser origins for CORS (no wildcards) |
| `SENTRY_DSN` | No | Sentry Node DSN |
| `PORT` | No | Listen port (default `5000`) |

`NODE_ENV=production` on Railway hides dev-only routes (`/test-db`, `/protected`, `/sentry-test`).

## Local development

### 1. Install dependencies

```sh
cd server && npm install
cd ../client && npm install
```

### 2. PostgreSQL setup

Create a local database and set `DATABASE_URL` in `server/.env`.

**Fresh local database** — `schema.sql` includes the full current feature set (users, plaid, accounts, transactions, insights, actions, chat, notifications, expense analyzer narratives, monthly trackers, savings detections):

```sh
cd server
psql "$DATABASE_URL" -f db/schema.sql
```

**Upgrading an older database** — run incremental migrations in order (see table below), or use the verify/apply scripts.

| File | Purpose |
|------|---------|
| `001_clerk_user_ids.sql` | Clerk string user IDs |
| `002_create_actions_table.sql` | Action items |
| `003_add_last_synced_at.sql` | Sync timestamp on accounts |
| `004_allow_null_account_id.sql` | Nullable `transactions.account_id` |
| `005_create_plaid_items.sql` | `plaid_items` + backfill |
| `006_create_chat_messages.sql` | Per-insight chat |
| `007_add_subscription_tier.sql` | `users.subscription_tier` |
| `008_expense_analyzer_narrative_cache.sql` | Narrative cache |
| `009_create_notifications.sql` | In-app notifications |
| `010_add_notification_preferences.sql` | Proactive prefs column |
| `011_add_monthly_budget.sql` | Legacy budget column |
| `012_create_savings_goals.sql` | Legacy (superseded by 013) |
| `013_create_monthly_trackers.sql` | Spending/saving trackers |
| `014_saving_tracker_monthly_progress.sql` | Monthly savings progress |
| `015_unique_active_spending_tracker.sql` | One active spending cap |
| `016_spending_alert_thresholds.sql` | Custom alert thresholds |
| `017_savings_transfer_detections.sql` | Savings transfer detections |
| `018_spending_cap_notification_types.sql` | Cap alert trigger types |
| `024_ritual_notification_types.sql` | Weekly truth letter + month-end letter notify types |
| `019_stripe_billing_columns.sql` | Stripe customer / subscription ids |
| `020_category_soft_limits.sql` | Per-category soft limits |
| `021_plaid_external_item_id.sql` | Plaid webhook item id mapping |

Do **not** re-run early migrations blindly after a fresh `schema.sql` — many changes are already present.

### 3. Configure env files

- `server/.env` — include `http://localhost:5173` in `ALLOWED_ORIGINS`
- `client/.env` — copy from `client/.env.example`; set `VITE_API_URL`

### 4. Start dev servers

```sh
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

- API health: `GET http://localhost:5000/`
- Client: `http://localhost:5173`

### 5. Tests

```sh
cd server && npm run test:all
cd client && npm run test:all && npm run lint && npm run build
```

CI runs the same suites on every PR (see `.github/workflows/ci.yml`).

## Deploy

### Client — Vercel

1. Root Directory: `client`
2. Build: `npm run build` → `dist`
3. Set `VITE_*` env vars (inlined at build time)
4. `client/vercel.json` rewrites to `index.html` for SPA routes

### Server — Railway

1. Root path: `server`
2. Start: `npm start`
3. Attach Postgres; set all server env vars
4. List every frontend origin in `ALLOWED_ORIGINS` (production + preview URLs)

### Database migrations (manual — required on deploy)

Migrations are **not** applied automatically. After deploying code that needs new tables/columns:

```sh
cd server
DATABASE_URL='<railway-postgres-url>' npm run verify:all-migrations
DATABASE_URL='<railway-postgres-url>' npm run verify:all-migrations -- --apply
```

Or apply a single migration, e.g.:

```sh
DATABASE_URL='...' npm run migrate:019
```

**Schema feature caches** (trackers / savings detections) refresh about every **60 seconds**, so new columns/tables become visible without a hard restart. A process restart still clears caches immediately.

`verify:migrations` is an alias of `verify:all-migrations` (covers **006–024**). Focused scripts remain: `verify:tracker-migrations`, `verify:notification-trigger-types`.

Scripts refuse localhost unless `ALLOW_LOCAL_DB=1`. Use Railway’s **public** Postgres URL from the Connect tab for production.

## Stripe (Soverm Pro)

1. Create a Product + recurring Price in Stripe; put the Price id in `STRIPE_PRICE_ID`
2. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_BASE_URL` (your Vercel URL)
3. Point a Stripe webhook at `POST https://<api-host>/webhooks/stripe` for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Run migration `019` so `users.stripe_*` columns exist

Without these env vars, `POST /api/billing/checkout` returns 503 and the client shows a friendly toast.

## API routes (summary)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check |
| `POST` | `/webhooks/clerk` | Clerk user sync / update / delete |
| `POST` | `/webhooks/stripe` | Stripe Checkout / subscription sync |
| `POST` | `/webhooks/plaid` | Plaid transaction sync push |
| `POST` | `/api/billing/checkout` | Create Pro Checkout session |
| `GET` | `/api/export/monthly-snapshot` | Monthly JSON/CSV export |
| `GET`/`POST`/`DELETE` | `/api/category-limits` | Category soft limits |
| `POST` | `/api/plaid/create-link-token` | Plaid Link token |
| `POST` | `/api/plaid/exchange-public-token` | Save linked accounts |
| `POST` | `/api/plaid/sync-transactions` | Sync transactions |
| `DELETE` | `/api/plaid/accounts/:accountId` | Disconnect bank account |
| `GET` | `/api/insights/usage` | Daily usage / tier |
| `POST` | `/api/insights/generate` | Generate AI insight |
| `GET` | `/api/dashboard/summary` | Dashboard data (`?range=`) |
| `GET` | `/api/dashboard/forecast` | 30-day cash-flow forecast |
| `GET` | `/api/actions` | List action items |
| `PATCH` | `/api/actions/:id` | Toggle action completed |
| `GET` | `/api/history` | Insight history |
| `GET`/`POST` | `/api/chat/general` | Chat without a weekly insight |
| `GET`/`POST` | `/api/chat/:insightId` | Load / send insight chat |
| `GET` | `/api/expense-analyzer` | Full expense analyzer |
| `GET` | `/api/expense-analyzer/summary` | Dashboard teaser |
| `GET`/`POST` | `/api/expense-analyzer/narrative` | Narrative cache / generate |
| `GET` | `/api/notifications` | List + prefs |
| `GET` | `/api/notifications/unread-count` | Badge count |
| `PATCH` | `/api/notifications/preferences` | Toggle proactive alerts |
| `PATCH` | `/api/notifications/read-all`, `/:id/read` | Mark read |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/trackers` | Budgets & goals |
| `POST` | `/api/trackers/savings-detections/:id/apply` | Confirm transfer |
| `POST` | `/api/trackers/savings-detections/:id/dismiss` | Dismiss transfer |
| `DELETE` | `/api/user` | Delete account and all data |

Dev-only when `NODE_ENV !== 'production'`: `GET /test-db`, `GET /protected`, `GET /sentry-test`.

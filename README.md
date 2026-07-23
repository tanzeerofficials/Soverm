# Soverm

**Soverm** is an AI personal CFO: connect bank accounts via Plaid, sync transactions, generate Claude-powered financial insights, analyze expenses, track spending caps and savings goals, project cash flow, and follow up in chat. Auth is handled by Clerk; data is stored in PostgreSQL.

The product name is **Soverm** (see `client/index.html` and the landing page at `/`). Spell it **Soverm** in all user-facing copy — not Sovrm or Sovrn. Set the Clerk Dashboard application name to **Soverm** so sign-in modals match.

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

**Content-Security-Policy (CSP)** is enabled on the Vercel frontend (`client/vercel.json`). The allowlist lives in `client/src/lib/contentSecurityPolicy.js` (Clerk, Plaid, Stripe, fonts, Sentry, PostHog, Railway API). After editing it, run `cd client && npm run csp:sync`. If your API uses a custom domain, sync with `VITE_API_URL=https://your-api.example.com npm run csp:sync`. Local Vite `npm run dev` does not use this header (HMR would break); it applies in production on Vercel.

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

**Fresh local database** — `schema.sql` includes the full current feature set (users, plaid, accounts, transactions, insights, actions, chat, notifications, expense analyzer narratives, monthly trackers, savings detections, Plaid + Stripe webhook idempotency):

```sh
cd server
psql "$DATABASE_URL" -f db/schema.sql
npm run migrate
```

The `npm run migrate` afterward is what makes this bulletproof against schema.sql drifting behind the newest migrations over time — it backfills everything schema.sql already covers and applies anything it doesn't yet (verified end-to-end against a scratch database while building the migration runner).

**Upgrading an older database** — run:

```sh
cd server
npm run migrate
```

One command, safe to run repeatedly. It tracks applied migrations in a `schema_migrations` table; migrations already present (e.g. from a fresh `schema.sql` load, or a database migrated the old way) are detected and recorded without re-running their SQL. Add `-- --dry-run` to preview without writing anything. The old `migrate:0XX` per-migration scripts still work (each now prints a deprecation notice) but `npm run migrate` is the supported path going forward. The table below documents what each migration file does; use `verify:all-migrations` for a deploy-checklist-oriented check.

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

**Server test structure** — `server/scripts/test-*.js` all run under Node's built-in
test runner (`node --test`), not a hand-rolled assert harness. `npm run test:all` runs
every pure-unit test file in one invocation and prints a single aggregate summary
(pass/fail/duration) instead of a `&&`-chained sequence that stops at the first failure.
Each file also has its own `npm run test:<name>` for running it in isolation during dev.

Three scripts need a live Postgres connection (`test-trackers-routes.js`,
`verify-history-reload.js`, `verify-stored-insights.js`) and live in a separate
`npm run test:integration` — CI has no `DATABASE_URL`, so these are excluded from the
default `test:all` run. Run them locally against your dev database:

```sh
cd server && npm run test:integration
```

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

### Background jobs (pg-boss)

Plaid sync (every 4h + webhook-triggered), the weekly digest, and the month-condition
notify email all run as durable Postgres-backed jobs via [pg-boss](https://github.com/timgit/pg-boss)
(`queue/`), not in-process `node-cron`. Jobs survive a deploy/restart between being
queued and running, and are retried on failure — a crash no longer silently drops a
sync the way the old `setImmediate` webhook handler could.

**Default deploy (single Railway service)** — nothing to configure. `npm start` runs
one process that serves HTTP **and** processes the queue, same as today.

**Optional: a dedicated worker service** — if web traffic and background job volume
need to scale independently, add a second Railway service pointed at the same repo
with:

```
Start command: npm run worker
```

`WORKER_MODE=1` (baked into that script) makes the process run queue workers only, no
HTTP listener. Run any number of default-mode and worker-mode processes together —
pg-boss's own locking (`FOR UPDATE SKIP LOCKED` dequeue + an `exclusive` queue policy
keyed per user for Plaid syncs) guarantees a job is never processed twice, no matter
how many processes are polling.

**Verifying the queue** (e.g. after this change, or after adding a worker service):

```sh
cd server
npm run dev              # terminal 1 — default mode
npm run dev:worker       # terminal 2 — worker-only mode
node scripts/enqueue-sync.js <a real userId>   # terminal 3
```

Exactly one of the two terminals should log `[sync-user] <userId>: N added, ...` —
confirm via `SELECT state FROM pgboss.job ORDER BY created_on DESC LIMIT 1;` that the
job reached `completed`.

### Rate limiting (distributed)

All five API rate limiters (`middleware/security.js`) share a Postgres-backed store
(`rate_limit_hits`, see `middleware/postgresRateLimitStore.js`) instead of
`express-rate-limit`'s default in-memory store. In-memory counts are per-process — run
2+ Railway replicas (or a `WORKER_MODE=1` process) and each instance would enforce the
full configured limit independently, so the real ceiling silently becomes
`max × instance count`. Each limiter uses its own key prefix (`global`, `webhook`,
`plaid`, `sync`, `narrative`) so the same userId/IP tracked by two different limiters
never shares a counter.

The chat/insight limits in `utils/rateLimit.js` are separate and already multi-instance-safe
(DB-backed reservation under a row lock) — untouched by this.

**Verifying the shared limit** — start two instances on different ports sharing the
same `DATABASE_URL`, then send more combined requests than the configured max to an
unauthenticated route (`/webhooks/plaid` works — the limiter runs before signature
verification, so a 401 still counts as a hit):

```sh
cd server
PORT=3101 npm start &
PORT=3102 npm start &
# hammer both ports with more requests combined than the dev max (1000/min) and tally
# non-429 responses — the combined total across both ports should be ~1000, not ~2000.
```

### Database migrations (manual — required on deploy)

Migrations are **not** applied automatically. After deploying code that needs new tables/columns:

```sh
cd server
DATABASE_URL='<railway-postgres-url>' npm run migrate
```

Safe to run every deploy — already-applied migrations are detected and skipped, nothing re-runs. Add `-- --dry-run` first if you want to preview what would happen against production before writing.

`verify:all-migrations` (and its alias `verify:migrations`) remains available as a separate deploy-checklist tool — it covers migrations 006–025 specifically and refuses to run against localhost unless `ALLOW_LOCAL_DB=1`, which makes it a good pre-deploy sanity check in CI/CD. `npm run migrate` is the complete, general-purpose runner (all 31 migration files) for actually applying schema changes.

**Schema feature caches** (trackers / savings detections) refresh about every **60 seconds**, so new columns/tables become visible without a hard restart. A process restart still clears caches immediately.

`verify:migrations` is an alias of `verify:all-migrations` (covers **006–025**). Focused scripts remain: `verify:tracker-migrations`, `verify:notification-trigger-types`.

Scripts refuse localhost unless `ALLOW_LOCAL_DB=1`. Use Railway’s **public** Postgres URL from the Connect tab for production.

## Stripe (Soverm Pro)

Soverm Pro is **$6.99/mo**. Free: 1 AI insight/day + 7-day history. Pro: unlimited insights (safety ceiling 30/day) + full history.

### Production setup checklist (launch gate)

Complete **before** inviting next-week testers. Deploy **client + API together** so Manage billing / portal UI matches the API.

**Railway env (API service)**

| Variable | Production value |
|----------|------------------|
| `STRIPE_SECRET_KEY` | Live `sk_live_…` (or `sk_test_…` until you go live) |
| `STRIPE_PRICE_ID` | Recurring Price id `price_…` (not Product id) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the destination below |
| `APP_BASE_URL` | `https://soverm.vercel.app` (no trailing slash) |

**Database**

```sh
# From server/ against Railway public DATABASE_URL
DATABASE_URL='...' npm run migrate
# Expect: 019 and 025 report already-applied or apply once; everything else already tracked
```

Migration **025** stores cancel-at-period-end so Profile can show when Pro access ends after a portal cancel.

Confirm `users.stripe_customer_id` and `users.stripe_subscription_id` exist (`verify:migrations` covers 019).

**Stripe Dashboard**

1. Webhook destination → `https://soverm-production.up.railway.app/webhooks/stripe`
2. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Customer Portal → allow payment method update + **cancel** (portal cancels fire the subscription events above)

**15-minute smoke (human)**

Do this in the browser (not a terminal script). Local `sk_test_…` keys use card `4242 4242 4242 4242`.

1. Fresh Free user on [soverm.vercel.app](https://soverm.vercel.app) (or local `http://localhost:5173`)
2. Settings → **Upgrade** → Stripe Checkout with test/live card
3. Return → Settings shows **Pro** within ~30s (webhook)
4. **Manage billing** opens Customer Portal
5. Cancel subscription in portal → confirmation (“Plan canceled”)
   - Default portal cancel is **at period end** — Settings stays **Pro** until the period ends (status still `active`). That’s expected.
   - To verify Free sync immediately: in Stripe Dashboard → Customers → subscription → Cancel → **Cancel immediately**, then Settings should show **Free** within ~30s (`customer.subscription.deleted`).
6. Optional: delete-account path on a throwaway Pro user — Stripe sub cancels, no leftover charge

Without the three Stripe env vars, `POST /api/billing/checkout` and `POST /api/billing/portal` return 503 and the client shows a friendly toast.

### Account deletion

Deleting an account cancels any active Stripe subscription first (so Stripe stops charging), then removes app data. Stripe outages are logged and do not block deletion.

### Billing API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/billing/status` | `{ configured, tier, isPro }` |
| `POST` | `/api/billing/checkout` | Create Pro Checkout session |
| `POST` | `/api/billing/portal` | Create Customer Portal session (Pro) |
| `POST` | `/webhooks/stripe` | Checkout / subscription sync |

## API routes (summary)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check |
| `POST` | `/webhooks/clerk` | Clerk user sync / update / delete |
| `POST` | `/webhooks/stripe` | Stripe Checkout / subscription sync |
| `POST` | `/webhooks/plaid` | Plaid transaction sync push |
| `GET` | `/api/billing/status` | Billing configured + tier |
| `POST` | `/api/billing/checkout` | Create Pro Checkout session |
| `POST` | `/api/billing/portal` | Create Customer Portal session |
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

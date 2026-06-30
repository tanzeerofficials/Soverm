# Soverm — Client

React + Vite frontend for **Soverm** ([soverm.vercel.app](https://soverm.vercel.app)). Talks to the Express API on Railway; auth via Clerk; bank linking via Plaid Link (tokens from the API).

The product name is **Soverm** (`client/index.html` title: “Soverm — Your AI CFO”; landing page hero uses “SOVERM”).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (default `http://localhost:5173`) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## Environment variables

Copy `.env.example` to `.env`. Only variables prefixed with `VITE_` are exposed to the browser. **Names only — never commit real values.**

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk sign-in |
| `VITE_API_URL` | Yes | Backend base URL (no trailing slash), e.g. `http://localhost:5000` |
| `VITE_POSTHOG_KEY` | No | PostHog analytics; leave blank to disable |
| `VITE_POSTHOG_HOST` | No | PostHog ingest host |
| `VITE_POSTHOG_SESSION_RECORDING` | No | `true` to enable session replay |
| `VITE_SENTRY_DSN` | No | Sentry browser DSN; leave blank to disable |

**No Plaid env vars on the client.** `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` are server-only. Plaid Link is loaded from the CDN in `index.html`; the app fetches link tokens from `/api/plaid/create-link-token`.

This project uses `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` (not `VITE_PUBLIC_POSTHOG_*`).

Restart Vite after changing any `VITE_*` variable.

## Local development

```sh
npm install
npm run dev
```

1. Start the API from `../server` first (`npm run dev` there).
2. Set `VITE_API_URL` in `.env` to match the server port (default `5000`, or whatever `PORT` is in `server/.env`).
3. Open `http://localhost:5173`.

See the root [README](../README.md) for Postgres setup and full env var lists.

## Routes

| Path | Page | Auth |
|------|------|------|
| `/` | Landing (pricing, security FAQ) | Public |
| `/privacy`, `/terms` | Legal placeholders | Public |
| `/dashboard` | Dashboard (accounts, insights, chat, Plaid) | Signed in |
| `/history` | Past insights | Signed in |
| `/settings` | Plan, banks, account deletion | Signed in |

Unknown paths → 404 page. Footer with privacy/terms links appears on all routes.

## Deploy — Vercel

1. Set **Root Directory** to `client` in the Vercel project.
2. Build: `npm run build` · Output: `dist`
3. Add env vars in the Vercel dashboard before build:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_API_URL` → Railway API URL
   - Optional: `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_POSTHOG_SESSION_RECORDING`, `VITE_SENTRY_DSN`
4. `vercel.json` rewrites all paths to `index.html` for client-side routing.

Change a `VITE_*` variable → trigger a new deploy so the bundle picks it up.

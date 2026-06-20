# Sovrn CFO Agent

Sovrn is an AI-powered personal CFO foundation. The app is set up to support Plaid bank connections, transaction tracking, Claude-powered financial insights, and proactive notifications, without connecting to external APIs yet.

## Tech Stack

- Client: React, Vite, Tailwind CSS, React Router DOM, Axios, TanStack React Query
- Server: Node.js, Express, ES Modules, CORS, Dotenv, PostgreSQL `pg`, Plaid SDK, Anthropic SDK, node-cron, Nodemon

## Project Structure

```txt
cfo-agent/
├── client/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── main.jsx
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   │   ├── plaid.js
│   │   ├── claude.js
│   │   └── notifications.js
│   ├── db/
│   │   └── index.js
│   ├── .env
│   └── index.js
└── README.md
```

## Environment

The server expects these variables in `server/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cfo_agent
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
ANTHROPIC_API_KEY=
```

The current setup does not call Plaid, Anthropic, or PostgreSQL automatically.

## Run Locally

Open two terminal windows.

Terminal 1:

```sh
cd server
npm run dev
```

Terminal 2:

```sh
cd client
npm run dev
```

The API health check runs at `http://localhost:5000/` and returns:

```json
{ "message": "CFO Agent API is running" }
```

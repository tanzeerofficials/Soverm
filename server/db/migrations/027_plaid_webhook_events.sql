/*
 * Migration 027 — Plaid webhook event dedup + status tracking
 *
 * What: stores verified Plaid webhook event ids so we can ACK quickly,
 * skip duplicates, and process sync work asynchronously.
 */

CREATE TABLE IF NOT EXISTS plaid_webhook_events (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  webhook_type TEXT,
  webhook_code TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS plaid_webhook_events_status_created_idx
  ON plaid_webhook_events (status, created_at DESC);

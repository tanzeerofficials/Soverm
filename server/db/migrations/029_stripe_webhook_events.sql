/*
 * Migration 029 — Stripe webhook event idempotency
 *
 * What: persist Stripe event.id so replays do not re-run billing side effects.
 */

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_created_idx
  ON stripe_webhook_events (created_at DESC);

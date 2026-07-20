/*
 * Migration 028 — chat context epoch for multi-replica snapshot cache
 *
 * What: bumps whenever money settings change without a new Plaid sync
 * (soft limits, payday, trackers, disconnect). Chat snapshot cache keys
 * include this epoch so replica B does not serve a stale in-memory pack
 * after replica A invalidated.
 */

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS chat_context_epoch INTEGER NOT NULL DEFAULT 0;

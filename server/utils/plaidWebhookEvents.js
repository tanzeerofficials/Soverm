/*
 * PLAID WEBHOOK EVENT TRACKING
 *
 * Dedup + status bookkeeping for plaid_webhook_events, shared by:
 * - routes/plaidWebhooks.js (verifies signature, builds the event id, claims it)
 * - queue/handlers.js (marks processing/done/failed as the queued job runs)
 *
 * Extracted so both sides import the same logic instead of one depending on
 * the other's route file.
 */

import { createHash } from 'crypto'
import db from '../db/index.js'

export function buildWebhookEventId({ itemId, webhookType, webhookCode, bodyHash, claims }) {
  const jwtId = typeof claims?.jti === 'string' ? claims.jti : ''
  const issuedAt = claims?.iat != null ? String(claims.iat) : ''
  return createHash('sha256')
    .update(
      [itemId || '', webhookType || '', webhookCode || '', bodyHash || '', jwtId, issuedAt].join('|')
    )
    .digest('hex')
}

export async function claimWebhookEvent({ eventId, itemId, webhookType, webhookCode, userId }) {
  try {
    const result = await db.query(
      `INSERT INTO plaid_webhook_events (
         id, item_id, webhook_type, webhook_code, user_id, status
       )
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [eventId, itemId, webhookType, webhookCode, userId]
    )
    return { claimed: result.rows.length > 0 }
  } catch (err) {
    // Migration 027 not applied yet — process without dedup rather than 500.
    if (err.code === '42P01') {
      console.warn(
        '[plaid-webhook] plaid_webhook_events missing — run migration 027; processing without dedup'
      )
      return { claimed: true, dedupUnavailable: true }
    }
    throw err
  }
}

export async function markWebhookEvent(eventId, status, errorMessage = null) {
  try {
    await db.query(
      `UPDATE plaid_webhook_events
       SET status = $2,
           error_message = $3,
           processed_at = CASE WHEN $2 IN ('done', 'failed') THEN NOW() ELSE processed_at END
       WHERE id = $1`,
      [eventId, status, errorMessage]
    )
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[plaid-webhook] failed to update event status:', err.message)
    }
  }
}

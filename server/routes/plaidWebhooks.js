/*
 * PLAID WEBHOOKS
 *
 * Push-triggered sync when Plaid has new transactions available.
 * The sync-fanout queue schedule remains as a fallback (every 4h).
 * Requires plaid_items.plaid_external_item_id.
 *
 * Flow: verify signature → dedupe event id → ACK 200 → enqueue sync-user job.
 * The job is a durable Postgres row (pg-boss), not a fire-and-forget
 * setImmediate — it survives a deploy/restart between the ACK and the sync
 * actually running, and is retried on failure.
 */

import { Router } from 'express'
import { createHash } from 'crypto'
import { jwtVerify, decodeProtectedHeader, importJWK } from 'jose'
import db from '../db/index.js'
import { plaidClient } from '../services/plaid.js'
import { enqueueUserSync } from '../queue/boss.js'
import {
  buildWebhookEventId,
  claimWebhookEvent,
} from '../utils/plaidWebhookEvents.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()
const keyCache = new Map()
const MAX_CACHED_WEBHOOK_KEYS = 32
/** Plaid kids are opaque ids — reject junk before calling their API. */
const PLAID_KID_RE = /^[A-Za-z0-9_-]{8,128}$/

async function getPlaidWebhookKey(keyId) {
  if (typeof keyId !== 'string' || !PLAID_KID_RE.test(keyId)) {
    throw new Error('invalid_webhook_kid')
  }

  if (keyCache.has(keyId)) {
    return keyCache.get(keyId)
  }

  const response = await plaidClient.webhookVerificationKeyGet({ key_id: keyId })
  const jwk = response.data?.key
  if (!jwk) {
    throw new Error('missing_webhook_jwk')
  }

  // Only cache keys Plaid actually returned (never cache failed lookups).
  const key = await importJWK(jwk, 'ES256')

  if (keyCache.size >= MAX_CACHED_WEBHOOK_KEYS) {
    const oldestKid = keyCache.keys().next().value
    keyCache.delete(oldestKid)
  }

  keyCache.set(keyId, key)
  return key
}

async function verifyPlaidWebhook(rawBody, verificationHeader) {
  if (!verificationHeader) {
    return { ok: false }
  }

  let header
  try {
    header = decodeProtectedHeader(verificationHeader)
  } catch {
    return { ok: false }
  }

  if (!header.kid) {
    return { ok: false }
  }

  let key
  try {
    key = await getPlaidWebhookKey(header.kid)
  } catch {
    // Invalid kid shape, Plaid miss, or network error — do not grow the cache.
    return { ok: false }
  }

  try {
    const { payload } = await jwtVerify(verificationHeader, key, {
      algorithms: ['ES256'],
    })

    const bodyHash = createHash('sha256').update(rawBody).digest('hex')
    if (payload.request_body_sha256 !== bodyHash) {
      return { ok: false }
    }

    return { ok: true, claims: payload, bodyHash }
  } catch {
    return { ok: false }
  }
}

router.post('/', async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))

    const verified = await verifyPlaidWebhook(rawBody, req.headers['plaid-verification'])
    if (!verified.ok) {
      return res.status(401).json({ error: 'Invalid Plaid webhook signature' })
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    const webhookType = payload.webhook_type
    const webhookCode = payload.webhook_code
    const itemId = payload.item_id

    const shouldSync =
      webhookType === 'TRANSACTIONS' &&
      ['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(
        webhookCode
      )

    if (!shouldSync || !itemId) {
      return res.json({ received: true, synced: false })
    }

    const itemResult = await db.query(
      `SELECT user_id
       FROM plaid_items
       WHERE plaid_external_item_id = $1
       LIMIT 1`,
      [itemId]
    )

    const userId = itemResult.rows[0]?.user_id
    if (!userId) {
      console.warn(`[plaid-webhook] unknown item_id ${itemId}`)
      return res.json({ received: true, synced: false, reason: 'unknown_item' })
    }

    const eventId = buildWebhookEventId({
      itemId,
      webhookType,
      webhookCode,
      bodyHash: verified.bodyHash,
      claims: verified.claims,
    })

    const claim = await claimWebhookEvent({
      eventId,
      itemId,
      webhookType,
      webhookCode,
      userId,
    })

    if (!claim.claimed) {
      return res.json({ received: true, deduped: true })
    }

    // ACK first — sync + notification scans can take longer than Plaid's timeout.
    // enqueueUserSync writes a durable job row before we respond, so the sync
    // survives a deploy/restart even if it hasn't run yet (unlike the old
    // setImmediate, which lost the work entirely if the process died first).
    await enqueueUserSync({ userId, webhookEventId: eventId })
    res.json({ received: true, queued: true })
  } catch (err) {
    reportServerError('to process Plaid webhook', err, { req })
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process Plaid webhook' })
    }
  }
})

export default router

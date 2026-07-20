/*
 * PLAID WEBHOOKS
 *
 * Push-triggered sync when Plaid has new transactions available.
 * Cron remains as a fallback. Requires plaid_items.plaid_external_item_id.
 *
 * Flow: verify signature → dedupe event id → ACK 200 → process sync async.
 * Holding the HTTP response open for sync + notification scans caused
 * timeouts and duplicate Plaid retries.
 */

import { Router } from 'express'
import { createHash } from 'crypto'
import { jwtVerify, decodeProtectedHeader, importJWK } from 'jose'
import db from '../db/index.js'
import { plaidClient, syncAllAccountsForUser } from '../services/plaid.js'
import { evaluateAndCreateProactiveNotifications } from '../services/proactiveNotifications.js'
import { scanAndStoreSavingsTransferDetections } from '../services/savingsTransferDetection.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()
const keyCache = new Map()

async function getPlaidWebhookKey(keyId) {
  if (keyCache.has(keyId)) {
    return keyCache.get(keyId)
  }

  const response = await plaidClient.webhookVerificationKeyGet({ key_id: keyId })
  const jwk = response.data.key
  const key = await importJWK(jwk, 'ES256')
  keyCache.set(keyId, key)
  return key
}

async function verifyPlaidWebhook(rawBody, verificationHeader) {
  if (!verificationHeader) {
    return { ok: false }
  }

  const header = decodeProtectedHeader(verificationHeader)
  if (!header.kid) {
    return { ok: false }
  }

  const key = await getPlaidWebhookKey(header.kid)
  const { payload } = await jwtVerify(verificationHeader, key, {
    algorithms: ['ES256'],
  })

  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  if (payload.request_body_sha256 !== bodyHash) {
    return { ok: false }
  }

  return { ok: true, claims: payload, bodyHash }
}

function buildWebhookEventId({ itemId, webhookType, webhookCode, bodyHash, claims }) {
  const jwtId = typeof claims?.jti === 'string' ? claims.jti : ''
  const issuedAt = claims?.iat != null ? String(claims.iat) : ''
  return createHash('sha256')
    .update(
      [itemId || '', webhookType || '', webhookCode || '', bodyHash || '', jwtId, issuedAt].join('|')
    )
    .digest('hex')
}

async function claimWebhookEvent({ eventId, itemId, webhookType, webhookCode, userId }) {
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

async function markWebhookEvent(eventId, status, errorMessage = null) {
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

async function processWebhookSync(userId, eventId) {
  await markWebhookEvent(eventId, 'processing')
  try {
    await syncAllAccountsForUser(userId)
    await evaluateAndCreateProactiveNotifications(userId)
    await scanAndStoreSavingsTransferDetections(userId)
    await markWebhookEvent(eventId, 'done')
  } catch (err) {
    await markWebhookEvent(eventId, 'failed', err.message?.slice(0, 500) ?? 'unknown_error')
    reportServerError('to process Plaid webhook async sync', err, { userId })
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
    res.json({ received: true, queued: true })

    setImmediate(() => {
      processWebhookSync(userId, eventId)
    })
  } catch (err) {
    reportServerError('to process Plaid webhook', err, { req })
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process Plaid webhook' })
    }
  }
})

export default router

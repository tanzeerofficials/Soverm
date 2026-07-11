/*
 * PLAID WEBHOOKS
 *
 * Push-triggered sync when Plaid has new transactions available.
 * Cron remains as a fallback. Requires plaid_items.plaid_external_item_id.
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
    return false
  }

  const header = decodeProtectedHeader(verificationHeader)
  if (!header.kid) {
    return false
  }

  const key = await getPlaidWebhookKey(header.kid)
  const { payload } = await jwtVerify(verificationHeader, key, {
    algorithms: ['ES256'],
  })

  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  return payload.request_body_sha256 === bodyHash
}

router.post('/', async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}))

    const ok = await verifyPlaidWebhook(rawBody, req.headers['plaid-verification'])
    if (!ok) {
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

    await syncAllAccountsForUser(userId)
    await evaluateAndCreateProactiveNotifications(userId)
    await scanAndStoreSavingsTransferDetections(userId)

    res.json({ received: true, synced: true })
  } catch (err) {
    reportServerError('to process Plaid webhook', err, { req })
    res.status(500).json({ error: 'Failed to process Plaid webhook' })
  }
})

export default router

/*
 * Verifies buildWebhookEventId is deterministic and collision-resistant
 * across the fields that distinguish one Plaid webhook delivery from
 * another. No DB required (claimWebhookEvent / markWebhookEvent need a live
 * Postgres and are exercised via the manual queue verification instead —
 * see README "Verifying the queue").
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWebhookEventId } from '../utils/plaidWebhookEvents.js'

const base = {
  itemId: 'item-123',
  webhookType: 'TRANSACTIONS',
  webhookCode: 'SYNC_UPDATES_AVAILABLE',
  bodyHash: 'abc123',
  claims: { jti: 'jwt-1', iat: 1700000000 },
}

describe('buildWebhookEventId', () => {
  test('is deterministic for identical inputs', () => {
    assert.equal(buildWebhookEventId(base), buildWebhookEventId({ ...base }))
  })

  test('differs when the item id differs', () => {
    assert.notEqual(
      buildWebhookEventId(base),
      buildWebhookEventId({ ...base, itemId: 'item-456' })
    )
  })

  test('differs when the webhook code differs', () => {
    assert.notEqual(
      buildWebhookEventId(base),
      buildWebhookEventId({ ...base, webhookCode: 'DEFAULT_UPDATE' })
    )
  })

  test('differs when the JWT id (jti) differs — Plaid retries reuse the same body', () => {
    assert.notEqual(
      buildWebhookEventId(base),
      buildWebhookEventId({ ...base, claims: { ...base.claims, jti: 'jwt-2' } })
    )
  })

  test('differs when issued-at differs', () => {
    assert.notEqual(
      buildWebhookEventId(base),
      buildWebhookEventId({ ...base, claims: { ...base.claims, iat: 1700000001 } })
    )
  })

  test('tolerates missing claims (dedup still works, just coarser)', () => {
    const id = buildWebhookEventId({ ...base, claims: undefined })
    assert.equal(typeof id, 'string')
    assert.equal(id.length, 64) // sha256 hex
  })
})

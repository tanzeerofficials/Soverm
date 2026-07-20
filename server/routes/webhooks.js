/*
 * WEBHOOKS ROUTE FILE
 *
 * A "webhook" is like a doorbell from another service.
 * When something happens in Clerk (like a new user signs up),
 * Clerk rings our doorbell by sending an HTTP POST request here.
 *
 * We do NOT use normal login for webhooks.
 * Instead, we verify a special signature to prove the message
 * really came from Clerk and not a random stranger on the internet.
 *
 * PLAID WEBHOOKS: Handled at POST /webhooks/plaid (see plaidWebhooks.js).
 * Signature is verified with Plaid-Verification JWT (ES256 + body hash),
 * events are deduped in plaid_webhook_events, and sync runs asynchronously
 * after a fast 200 ACK. Cron remains a fallback sync path.
 *
 * CLERK WEBHOOKS: user.created inserts a Postgres row; user.updated syncs
 * email/name; user.deleted purges app data. Unknown events still return 200
 * so Clerk does not retry forever.
 */

import { Router } from 'express'
import { Webhook } from 'svix'
import db from '../db/index.js'
import { deleteAllUserData } from '../utils/deleteUserData.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

/*
 * POST /webhooks/clerk
 *
 * What it does:
 * - Receives events from Clerk (like user.created)
 * - Verifies the message is real
 * - Saves new users into our database
 *
 * Why we need it:
 * - Clerk knows about users in Clerk's system.
 * - Our app also needs users in OUR database so we can connect banks,
 *   save transactions, and show insights later.
 *
 * How it fits the app:
 * - Sign up happens in Clerk on the frontend
 * - Clerk sends webhook to backend
 * - Backend stores user in Postgres
 */
router.post('/clerk', async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET is not configured')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  // These 3 headers are used to prove the webhook is authentic (Svix signing).
  const svixId = req.headers['svix-id']
  const svixTimestamp = req.headers['svix-timestamp']
  const svixSignature = req.headers['svix-signature']

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(401).send('Webhook verification failed')
  }

  let event
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(req.body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (err) {
    reportServerError('to verify Clerk webhook', err, { req })
    return res.status(401).send('Webhook verification failed')
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses[0]?.email_address

    if (!id || !email) {
      return res.status(400).json({ error: 'Missing required user fields' })
    }

    const name = `${first_name ?? ''} ${last_name ?? ''}`.trim() || email

    try {
      await db.query(
        'INSERT INTO users (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, email, name]
      )
    } catch (err) {
      reportServerError('to insert user from webhook', err, { req })
      return res.status(500).json({ error: 'Failed to save user' })
    }

    return res.status(200).json({ received: true })
  }

  if (event.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses?.[0]?.email_address
    if (!id || !email) {
      return res.status(200).json({ received: true })
    }

    const name = `${first_name ?? ''} ${last_name ?? ''}`.trim() || email

    try {
      await db.query(
        `UPDATE users
         SET email = $1, name = $2
         WHERE id = $3`,
        [email, name, id]
      )
    } catch (err) {
      reportServerError('to update user from webhook', err, { req })
      return res.status(500).json({ error: 'Failed to update user' })
    }

    return res.status(200).json({ received: true })
  }

  if (event.type === 'user.deleted') {
    const { id } = event.data
    if (!id) {
      return res.status(200).json({ received: true })
    }

    try {
      // Purge Postgres + revoke Plaid; Clerk user is already deleted.
      await deleteAllUserData(id)
    } catch (err) {
      // Missing user is fine — already purged or never synced.
      if (!/not found|does not exist/i.test(err.message)) {
        reportServerError('to delete user from webhook', err, { req })
        return res.status(500).json({ error: 'Failed to delete user data' })
      }
    }

    return res.status(200).json({ received: true })
  }

  // For other event types we still say "got it" so Clerk does not retry forever.
  res.status(200).json({ received: true })
})

export default router

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
 */

import { Router } from 'express'
import { Webhook } from 'svix'
import db from '../db/index.js'
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

  // These 3 headers are used to prove the webhook is authentic.
  const svixId = req.headers['svix-id']
  const svixTimestamp = req.headers['svix-timestamp']
  const svixSignature = req.headers['svix-signature']

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
    return res.status(400).send('Webhook verification failed')
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

  // For other event types we still say "got it" so Clerk does not retry forever.
  res.status(200).json({ received: true })
})

export default router

/*
 * Ensures a Clerk user exists in our users table before FK-dependent writes.
 * Falls back to Clerk API when the webhook hasn't fired yet.
 *
 * Handles duplicate-email conflicts when a user re-signs in Clerk with a new
 * user id but the same email — archives the stale row's email (never deletes
 * the row or its linked accounts) so the current Clerk id can be inserted.
 */

import { clerkClient } from '@clerk/express'
import db from '../db/index.js'

export async function ensureUserExists(userId) {
  const existing = await db.query('SELECT id FROM users WHERE id = $1', [userId])
  if (existing.rows.length > 0) {
    return
  }

  const user = await clerkClient.users.getUser(userId)
  const email = user.emailAddresses[0]?.emailAddress ?? `${userId}@users.local`
  const name =
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email

  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const emailConflict = await client.query(
      `SELECT id FROM users WHERE email = $1 AND id <> $2 FOR UPDATE`,
      [email, userId]
    )

    if (emailConflict.rows.length > 0) {
      const staleUserId = emailConflict.rows[0].id
      console.warn(
        `Stale users row blocks email ${email} (old id ${staleUserId}, current Clerk id ${userId}). Archiving old email; linked data stays on old id.`
      )
      await client.query(
        `UPDATE users SET email = $1 WHERE id = $2`,
        [`legacy-${staleUserId}@invalid.local`, staleUserId]
      )
    }

    await client.query(
      `INSERT INTO users (id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name`,
      [userId, email, name]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

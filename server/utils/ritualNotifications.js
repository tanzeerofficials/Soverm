/*
 * RITUAL NOTIFICATIONS
 *
 * In-app alerts for weekly truth letter + month-end accountant letter.
 * Deduped by weekStart / monthKey so cron re-runs stay quiet.
 *
 * Dedup uses UNIQUE (user_id, trigger_type, dedup_key) + ON CONFLICT so
 * concurrent workers cannot both insert the same ritual alert.
 */

import db from '../db/index.js'

export const RITUAL_TRIGGER_TYPES = {
  WEEKLY_TRUTH_LETTER: 'weekly_truth_letter',
  MONTH_CONDITION_READY: 'month_condition_ready',
}

export async function ritualNotificationExists(userId, triggerType, dedupKey) {
  const result = await db.query(
    `SELECT 1
     FROM notifications
     WHERE user_id = $1
       AND trigger_type = $2
       AND dedup_key = $3
     LIMIT 1`,
    [userId, triggerType, dedupKey]
  )
  return result.rows.length > 0
}

export async function insertRitualNotification({
  userId,
  triggerType,
  title,
  body,
  relatedData = {},
  dedupKey,
}) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (
         id, user_id, trigger_type, title, body, related_data, dedup_key
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (user_id, trigger_type, dedup_key)
         WHERE dedup_key IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [userId, triggerType, title, body, JSON.stringify(relatedData), dedupKey]
    )

    if (result.rows.length === 0) {
      return { created: false, reason: 'already_exists' }
    }

    return { created: true, id: result.rows[0].id }
  } catch (err) {
    // Migration 024 not applied yet — don't fail the whole digest/email job
    if (err.code === '23514' || /trigger_type/i.test(err.message)) {
      console.warn(
        `[ritual-notify] skipped insert (${triggerType}) — run migration 024 for ritual trigger types`
      )
      return { created: false, reason: 'trigger_type_not_allowed' }
    }
    // Migration 026 unique index missing — fall back to check-then-insert
    if (err.code === '42P10' || /no unique|ON CONFLICT/i.test(err.message)) {
      if (await ritualNotificationExists(userId, triggerType, dedupKey)) {
        return { created: false, reason: 'already_exists' }
      }
      await db.query(
        `INSERT INTO notifications (
           id, user_id, trigger_type, title, body, related_data, dedup_key
         )
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6)`,
        [userId, triggerType, title, body, JSON.stringify(relatedData), dedupKey]
      )
      return { created: true }
    }
    throw err
  }
}

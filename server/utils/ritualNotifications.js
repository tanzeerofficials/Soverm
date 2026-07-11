/*
 * RITUAL NOTIFICATIONS
 *
 * In-app alerts for weekly truth letter + month-end accountant letter.
 * Deduped by weekStart / monthKey so cron re-runs stay quiet.
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
  if (await ritualNotificationExists(userId, triggerType, dedupKey)) {
    return { created: false, reason: 'already_exists' }
  }

  try {
    await db.query(
      `INSERT INTO notifications (
         id, user_id, trigger_type, title, body, related_data, dedup_key
       )
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6)`,
      [userId, triggerType, title, body, JSON.stringify(relatedData), dedupKey]
    )
    return { created: true }
  } catch (err) {
    // Migration 024 not applied yet — don't fail the whole digest/email job
    if (err.code === '23514' || /trigger_type/i.test(err.message)) {
      console.warn(
        `[ritual-notify] skipped insert (${triggerType}) — run migration 024 for ritual trigger types`
      )
      return { created: false, reason: 'trigger_type_not_allowed' }
    }
    throw err
  }
}

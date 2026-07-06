import db from '../db/index.js'

/*
 * loadProactiveNotificationsEnabled(userId)
 *
 * Returns whether the user wants new proactive alerts. Defaults to true when
 * the preference column is missing (pre-migration) or the user row is absent.
 */
export async function loadProactiveNotificationsEnabled(userId) {
  try {
    const columnCheck = await db.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'proactive_notifications_enabled'`
    )

    if (columnCheck.rows.length === 0) {
      return true
    }

    const result = await db.query(
      `SELECT proactive_notifications_enabled
       FROM users
       WHERE id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return true
    }

    return result.rows[0].proactive_notifications_enabled !== false
  } catch (err) {
    console.error('Failed to load notification preference, defaulting to enabled:', err.message)
    return true
  }
}

export async function setProactiveNotificationsEnabled(userId, enabled) {
  const columnCheck = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'proactive_notifications_enabled'`
  )

  if (columnCheck.rows.length === 0) {
    throw new Error('Notification preferences are not available yet — run migration 010')
  }

  const result = await db.query(
    `UPDATE users
     SET proactive_notifications_enabled = $2
     WHERE id = $1
     RETURNING proactive_notifications_enabled`,
    [userId, Boolean(enabled)]
  )

  if (result.rows.length === 0) {
    throw new Error('User not found')
  }

  return result.rows[0].proactive_notifications_enabled
}

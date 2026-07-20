/*
 * Migration 026 — ritual notification dedup uniqueness
 *
 * What: UNIQUE (user_id, trigger_type, dedup_key) so concurrent cron workers
 * cannot insert duplicate week/month ritual notifications.
 *
 * Why: insertRitualNotification used check-then-insert against a non-unique
 * index; two workers could both pass the exists check and both insert.
 *
 * Existing databases may already contain duplicates. Keep the newest copy,
 * but preserve read=true if the user read any copy, before adding uniqueness.
 */

BEGIN;

-- Prevent a cron worker from inserting another duplicate during cleanup.
LOCK TABLE notifications IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id, trigger_type, dedup_key
      ORDER BY created_at DESC, id DESC
    ) AS keep_id,
    BOOL_OR(read) OVER (
      PARTITION BY user_id, trigger_type, dedup_key
    ) AS was_read
  FROM notifications
  WHERE dedup_key IS NOT NULL
)
UPDATE notifications AS notification
SET read = ranked.was_read
FROM ranked
WHERE notification.id = ranked.keep_id
  AND notification.read IS DISTINCT FROM ranked.was_read;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, trigger_type, dedup_key
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_number
  FROM notifications
  WHERE dedup_key IS NOT NULL
)
DELETE FROM notifications AS notification
USING ranked
WHERE notification.id = ranked.id
  AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_trigger_dedup_uidx
  ON notifications (user_id, trigger_type, dedup_key)
  WHERE dedup_key IS NOT NULL;

COMMIT;

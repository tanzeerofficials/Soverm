-- Enforce at most one active spending tracker per user.
-- Deactivate duplicates first (keeps the most recently updated row).

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM monthly_trackers
  WHERE track_type = 'spending' AND active = true
)
UPDATE monthly_trackers mt
SET active = false, updated_at = NOW()
FROM ranked
WHERE mt.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS monthly_trackers_one_active_spending_per_user_idx
  ON monthly_trackers (user_id)
  WHERE track_type = 'spending' AND active = true;

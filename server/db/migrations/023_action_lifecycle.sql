-- Closed-loop action statuses for weekly + insight actions.

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'done', 'skipped', 'dismissed')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'insight'
    CHECK (source IN ('insight', 'weekly')),
  ADD COLUMN IF NOT EXISTS week_start_on DATE,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outcome_summary TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Backfill from legacy completed flag
UPDATE actions
SET status = CASE WHEN completed THEN 'done' ELSE 'suggested' END
WHERE status = 'suggested' AND completed = true;

CREATE INDEX IF NOT EXISTS idx_actions_user_status
  ON actions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_actions_user_week
  ON actions (user_id, week_start_on)
  WHERE week_start_on IS NOT NULL;

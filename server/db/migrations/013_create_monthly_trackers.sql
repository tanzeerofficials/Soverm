CREATE TABLE IF NOT EXISTS monthly_trackers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('spending', 'saving')),
  name TEXT NOT NULL DEFAULT '',
  purpose_type TEXT CHECK (
    purpose_type IS NULL OR purpose_type IN ('debt', 'purchase', 'future')
  ),
  monthly_amount NUMERIC(12, 2) NOT NULL CHECK (monthly_amount > 0),
  target_total NUMERIC(12, 2) CHECK (target_total IS NULL OR target_total > 0),
  progress_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (progress_amount >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monthly_trackers_user_active_idx
  ON monthly_trackers (user_id, track_type)
  WHERE active = true;

-- Migrate existing spending budget (one per user)
INSERT INTO monthly_trackers (user_id, track_type, name, monthly_amount, active, created_at, updated_at)
SELECT u.id, 'spending', 'Monthly spending', u.monthly_budget, true, NOW(), NOW()
FROM users u
WHERE u.monthly_budget IS NOT NULL
  AND u.monthly_budget > 0
  AND NOT EXISTS (
    SELECT 1 FROM monthly_trackers mt
    WHERE mt.user_id = u.id AND mt.track_type = 'spending' AND mt.active = true
  );

-- Migrate existing savings goals
INSERT INTO monthly_trackers (
  user_id, track_type, name, purpose_type, monthly_amount, target_total, progress_amount, active, created_at, updated_at
)
SELECT
  sg.user_id,
  'saving',
  sg.name,
  sg.purpose_type,
  sg.monthly_amount,
  sg.target_total,
  sg.saved_so_far,
  sg.active,
  sg.created_at,
  sg.updated_at
FROM savings_goals sg
WHERE sg.active = true
  AND NOT EXISTS (
    SELECT 1 FROM monthly_trackers mt WHERE mt.id = sg.id
  );

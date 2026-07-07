CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purpose_type TEXT NOT NULL DEFAULT 'future'
    CHECK (purpose_type IN ('debt', 'purchase', 'future')),
  monthly_amount NUMERIC(12, 2) NOT NULL CHECK (monthly_amount > 0),
  target_total NUMERIC(12, 2) CHECK (target_total IS NULL OR target_total > 0),
  saved_so_far NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (saved_so_far >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS savings_goals_user_active_idx
  ON savings_goals (user_id)
  WHERE active = true;

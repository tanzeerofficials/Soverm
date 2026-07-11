-- Category soft limits (optional per-category monthly targets under the overall spending cap).

CREATE TABLE IF NOT EXISTS category_soft_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
  alert_warning_percent INTEGER NOT NULL DEFAULT 80
    CHECK (alert_warning_percent >= 1 AND alert_warning_percent <= 99),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_soft_limits_user_category_active_uidx
  ON category_soft_limits (user_id, category)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS category_soft_limits_user_active_idx
  ON category_soft_limits (user_id)
  WHERE active = true;

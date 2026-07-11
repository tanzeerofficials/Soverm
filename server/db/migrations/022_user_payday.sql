-- User payday preferences for paycheck-to-paycheck "what's left" coaching.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pay_cadence TEXT
    CHECK (pay_cadence IS NULL OR pay_cadence IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  ADD COLUMN IF NOT EXISTS next_payday_on DATE,
  ADD COLUMN IF NOT EXISTS payday_source TEXT
    CHECK (payday_source IS NULL OR payday_source IN ('inferred', 'user')),
  ADD COLUMN IF NOT EXISTS payday_updated_at TIMESTAMP;

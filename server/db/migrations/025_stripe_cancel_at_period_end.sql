-- Persist Stripe cancel-at-period-end so Profile can show when Pro access ends.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ;

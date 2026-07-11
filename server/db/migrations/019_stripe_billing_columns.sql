-- Stripe billing fields on users (Pro checkout + webhook sync).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_uidx
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_uidx
  ON users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

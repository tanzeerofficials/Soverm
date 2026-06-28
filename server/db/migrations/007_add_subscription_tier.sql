-- Adds a subscription tier to users so we can gate free-tier limits
-- (1 insight/day, 7-day history) vs. Soverm Pro (unlimited).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

ALTER TABLE users
  ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'pro'));

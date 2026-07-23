-- Distributed rate limiting (see middleware/postgresRateLimitStore.js).
-- Replaces express-rate-limit's default in-memory store so limits are
-- shared across Railway replicas instead of resetting independently per
-- instance. `key` is pre-namespaced per limiter (e.g. "plaid:user_123") so
-- one table safely serves every rate limiter in the app.

CREATE TABLE rate_limit_hits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMPTZ NOT NULL
);

CREATE INDEX rate_limit_hits_reset_time_idx ON rate_limit_hits (reset_time);

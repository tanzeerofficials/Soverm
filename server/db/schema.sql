CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_current_period_end TIMESTAMPTZ,
  proactive_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_budget NUMERIC(12, 2),
  pay_cadence TEXT CHECK (pay_cadence IS NULL OR pay_cadence IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  next_payday_on DATE,
  payday_source TEXT CHECK (payday_source IS NULL OR payday_source IN ('inferred', 'user')),
  payday_updated_at TIMESTAMP,
  chat_context_epoch INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX users_stripe_customer_id_uidx
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX users_stripe_subscription_id_uidx
  ON users (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id),
  -- Prefer PLAID_TOKEN_ENCRYPTION_KEY (enc:v1:…); plaintext only if key unset
  plaid_access_token TEXT UNIQUE NOT NULL,
  plaid_external_item_id TEXT,
  plaid_cursor TEXT,
  last_synced_at TIMESTAMP,
  institution_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX plaid_items_external_item_id_uidx
  ON plaid_items (plaid_external_item_id)
  WHERE plaid_external_item_id IS NOT NULL;

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  plaid_item_id UUID REFERENCES plaid_items(id),
  plaid_account_id TEXT UNIQUE,
  bank_name TEXT,
  account_name TEXT,
  account_type TEXT,
  balance_current NUMERIC,
  balance_available NUMERIC,
  currency TEXT DEFAULT 'USD',
  plaid_cursor TEXT,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX accounts_plaid_item_id_idx ON accounts(plaid_item_id);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  account_id UUID REFERENCES accounts(id),
  plaid_transaction_id TEXT UNIQUE,
  amount NUMERIC NOT NULL,
  name TEXT,
  category TEXT,
  date DATE,
  pending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX transactions_user_id_idx ON transactions(user_id);

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  type TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

CREATE INDEX insights_user_id_idx ON insights(user_id);

CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  insight_id UUID REFERENCES insights(id),
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'done', 'skipped', 'dismissed')),
  source TEXT NOT NULL DEFAULT 'insight'
    CHECK (source IN ('insight', 'weekly')),
  week_start_on DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome_summary TEXT,
  accepted_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_actions_insight_id ON actions(insight_id);
CREATE INDEX idx_actions_user_status ON actions (user_id, status);
CREATE INDEX idx_actions_user_week ON actions (user_id, week_start_on)
  WHERE week_start_on IS NOT NULL;

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  insight_id UUID REFERENCES insights(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_insight_id ON chat_messages(insight_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (
    trigger_type IN (
      'large_transaction',
      'low_balance',
      'new_recurring_charge',
      'spending_spike',
      'spending_cap_over',
      'spending_cap_warning',
      'weekly_truth_letter',
      'month_condition_ready'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_data JSONB NOT NULL DEFAULT '{}',
  dedup_key TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_dedup ON notifications(user_id, trigger_type, dedup_key, created_at DESC);
CREATE UNIQUE INDEX notifications_user_trigger_dedup_uidx
  ON notifications (user_id, trigger_type, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE TABLE expense_analyzer_narratives (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload_fingerprint TEXT NOT NULL,
  lead TEXT NOT NULL,
  paragraphs JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, payload_fingerprint)
);

CREATE INDEX idx_expense_analyzer_narratives_user_created
  ON expense_analyzer_narratives (user_id, created_at DESC);

CREATE TABLE monthly_trackers (
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
  monthly_progress_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_progress_amount >= 0),
  progress_month DATE,
  alert_warning_percent INTEGER
    CHECK (alert_warning_percent IS NULL OR (alert_warning_percent >= 1 AND alert_warning_percent <= 99)),
  alert_remaining_dollars NUMERIC(12, 2)
    CHECK (alert_remaining_dollars IS NULL OR alert_remaining_dollars > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX monthly_trackers_user_active_idx
  ON monthly_trackers (user_id, track_type)
  WHERE active = true;

CREATE UNIQUE INDEX monthly_trackers_one_active_spending_per_user_idx
  ON monthly_trackers (user_id)
  WHERE track_type = 'spending' AND active = true;

CREATE TABLE savings_transfer_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tracker_id UUID REFERENCES monthly_trackers(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  merchant_name TEXT NOT NULL DEFAULT '',
  transaction_date DATE NOT NULL,
  account_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE UNIQUE INDEX savings_transfer_detections_user_txn_idx
  ON savings_transfer_detections (user_id, transaction_id);

CREATE INDEX savings_transfer_detections_user_pending_idx
  ON savings_transfer_detections (user_id, status)
  WHERE status = 'pending';

CREATE TABLE category_soft_limits (
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

CREATE UNIQUE INDEX category_soft_limits_user_category_active_uidx
  ON category_soft_limits (user_id, category)
  WHERE active = true;

CREATE INDEX category_soft_limits_user_active_idx
  ON category_soft_limits (user_id)
  WHERE active = true;

CREATE TABLE plaid_webhook_events (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  webhook_type TEXT,
  webhook_code TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX plaid_webhook_events_status_created_idx
  ON plaid_webhook_events (status, created_at DESC);

-- Stripe webhook event idempotency (see db/migrations/029_stripe_webhook_events.sql)
CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX stripe_webhook_events_created_idx
  ON stripe_webhook_events (created_at DESC);

-- Distributed rate limiting (see db/migrations/031_rate_limit_hits.sql)
CREATE TABLE rate_limit_hits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  reset_time TIMESTAMPTZ NOT NULL
);

CREATE INDEX rate_limit_hits_reset_time_idx ON rate_limit_hits (reset_time);

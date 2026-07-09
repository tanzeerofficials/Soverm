CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  proactive_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_budget NUMERIC(12, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id),
  plaid_access_token TEXT UNIQUE NOT NULL,
  plaid_cursor TEXT,
  last_synced_at TIMESTAMP,
  institution_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  plaid_item_id UUID REFERENCES plaid_items(id),
  plaid_account_id TEXT UNIQUE,
  plaid_access_token TEXT,
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

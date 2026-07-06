CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  proactive_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
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

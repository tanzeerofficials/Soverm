CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  plaid_account_id TEXT UNIQUE,
  plaid_access_token TEXT,
  bank_name TEXT,
  account_name TEXT,
  account_type TEXT,
  balance_current NUMERIC,
  balance_available NUMERIC,
  currency TEXT DEFAULT 'USD',
  plaid_cursor TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

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

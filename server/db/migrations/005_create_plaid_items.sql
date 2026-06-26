CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id),
  plaid_access_token TEXT UNIQUE NOT NULL,
  plaid_cursor TEXT,
  last_synced_at TIMESTAMP,
  institution_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO plaid_items (user_id, plaid_access_token, plaid_cursor, last_synced_at, institution_name)
SELECT DISTINCT ON (a.plaid_access_token)
  a.user_id,
  a.plaid_access_token,
  a.plaid_cursor,
  a.last_synced_at,
  a.bank_name
FROM accounts a
WHERE a.plaid_access_token IS NOT NULL
ORDER BY a.plaid_access_token, a.last_synced_at DESC NULLS LAST;

ALTER TABLE accounts ADD COLUMN plaid_item_id UUID REFERENCES plaid_items(id);

UPDATE accounts a
SET plaid_item_id = pi.id
FROM plaid_items pi
WHERE a.plaid_access_token = pi.plaid_access_token;

CREATE INDEX accounts_plaid_item_id_idx ON accounts(plaid_item_id);

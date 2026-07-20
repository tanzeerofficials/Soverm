/*
 * Migration 030 — drop duplicate Plaid tokens on accounts
 *
 * Tokens live only on plaid_items (encrypted). accounts.plaid_access_token
 * was a legacy duplicate; new links already write NULL. This migration
 * moves any remaining orphan tokens onto plaid_items, links accounts, then
 * drops the column.
 */

INSERT INTO plaid_items (user_id, plaid_access_token, last_synced_at, institution_name)
SELECT DISTINCT ON (a.plaid_access_token)
  a.user_id,
  a.plaid_access_token,
  a.last_synced_at,
  a.bank_name
FROM accounts a
WHERE a.plaid_access_token IS NOT NULL
  AND a.plaid_item_id IS NULL
ORDER BY a.plaid_access_token, a.last_synced_at DESC NULLS LAST
ON CONFLICT (plaid_access_token) DO NOTHING;

UPDATE accounts a
SET plaid_item_id = pi.id
FROM plaid_items pi
WHERE a.plaid_item_id IS NULL
  AND a.plaid_access_token IS NOT NULL
  AND a.user_id = pi.user_id
  AND a.plaid_access_token = pi.plaid_access_token;

ALTER TABLE accounts DROP COLUMN IF EXISTS plaid_access_token;

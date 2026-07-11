-- Store Plaid's external item_id so webhooks can map Item → user.

ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS plaid_external_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS plaid_items_external_item_id_uidx
  ON plaid_items (plaid_external_item_id)
  WHERE plaid_external_item_id IS NOT NULL;

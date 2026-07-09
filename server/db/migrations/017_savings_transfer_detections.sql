-- Tracks detected savings transfers awaiting user confirm/dismiss.
-- One row per transaction — prevents double-counting on re-sync.

CREATE TABLE IF NOT EXISTS savings_transfer_detections (
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

CREATE UNIQUE INDEX IF NOT EXISTS savings_transfer_detections_user_txn_idx
  ON savings_transfer_detections (user_id, transaction_id);

CREATE INDEX IF NOT EXISTS savings_transfer_detections_user_pending_idx
  ON savings_transfer_detections (user_id, status)
  WHERE status = 'pending';

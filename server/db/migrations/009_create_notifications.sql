-- Fresh installs include spending_cap_* trigger types.
-- Existing DBs created before those types need migration 018 to widen the CHECK.
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
      'spending_cap_warning'
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

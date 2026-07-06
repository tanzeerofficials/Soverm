ALTER TABLE users
  ADD COLUMN IF NOT EXISTS proactive_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

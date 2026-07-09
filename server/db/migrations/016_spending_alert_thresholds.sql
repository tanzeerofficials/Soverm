-- Custom spending-cap warning thresholds (percent and/or remaining dollars).
-- NULL means "not set". When both are NULL, the app defaults to 80%.

ALTER TABLE monthly_trackers
  ADD COLUMN IF NOT EXISTS alert_warning_percent INTEGER
    CHECK (alert_warning_percent IS NULL OR (alert_warning_percent >= 1 AND alert_warning_percent <= 99)),
  ADD COLUMN IF NOT EXISTS alert_remaining_dollars NUMERIC(12, 2)
    CHECK (alert_remaining_dollars IS NULL OR alert_remaining_dollars > 0);

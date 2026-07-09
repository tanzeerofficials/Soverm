-- Separate monthly savings progress from lifetime total toward a goal.
-- progress_amount = cumulative saved toward target_total (legacy saved_so_far).
-- monthly_progress_amount resets each calendar month; progress_month tracks which month it belongs to.

ALTER TABLE monthly_trackers
  ADD COLUMN IF NOT EXISTS monthly_progress_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (monthly_progress_amount >= 0),
  ADD COLUMN IF NOT EXISTS progress_month DATE;

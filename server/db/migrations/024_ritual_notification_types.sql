-- Allow ritual notification trigger types for weekly truth letter + month-end letter.

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_trigger_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_trigger_type_check
  CHECK (
    trigger_type IN (
      'large_transaction',
      'low_balance',
      'new_recurring_charge',
      'spending_spike',
      'spending_cap_over',
      'spending_cap_warning',
      'weekly_truth_letter',
      'month_condition_ready'
    )
  );

-- Allow spending-cap proactive notification trigger types.
-- Migration 009 only allowed the original four triggers; code now also emits
-- spending_cap_over and spending_cap_warning (see proactiveNotificationRules.js).

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
      'spending_cap_warning'
    )
  );

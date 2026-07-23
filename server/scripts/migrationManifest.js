/*
 * MIGRATION MANIFEST
 *
 * Single source of truth for "what migrations exist, in what order, and how
 * do we know one is already applied" — consumed by migrate.js.
 *
 * Each entry's `isApplied(db)` check is what lets the runner safely backfill
 * schema_migrations against a database that was already migrated by hand
 * (via the old numbered `migrate:0XX` scripts, or via a fresh `schema.sql`
 * load, which already contains every migration's end state) — WITHOUT
 * re-running SQL that would error on a second CREATE TABLE / ADD CONSTRAINT.
 *
 * File ordering matters (applied in array order). `add_plaid_cursor.sql`
 * predates the numbered scheme (see git history) and is intentionally
 * first — it was already applied on any database old enough to matter, and
 * fresh installs get it for free from schema.sql.
 */

import {
  columnDataType,
  columnExists,
  columnIsNullable,
  constraintDefinitionContains,
  indexExists,
  tableExists,
} from './migrationProbes.js'

export const MIGRATIONS = [
  {
    filename: 'add_plaid_cursor.sql',
    isApplied: (db) => columnExists(db, 'accounts', 'plaid_cursor'),
  },
  {
    filename: '001_clerk_user_ids.sql',
    isApplied: async (db) => (await columnDataType(db, 'users', 'id')) === 'text',
  },
  {
    filename: '002_create_actions_table.sql',
    isApplied: (db) => tableExists(db, 'actions'),
  },
  {
    filename: '003_add_last_synced_at.sql',
    isApplied: (db) => columnExists(db, 'accounts', 'last_synced_at'),
  },
  {
    filename: '004_allow_null_account_id.sql',
    isApplied: (db) => columnIsNullable(db, 'transactions', 'account_id'),
  },
  {
    filename: '005_create_plaid_items.sql',
    isApplied: async (db) =>
      (await tableExists(db, 'plaid_items')) && (await columnExists(db, 'accounts', 'plaid_item_id')),
  },
  {
    filename: '006_create_chat_messages.sql',
    isApplied: (db) => tableExists(db, 'chat_messages'),
  },
  {
    filename: '007_add_subscription_tier.sql',
    isApplied: (db) => columnExists(db, 'users', 'subscription_tier'),
  },
  {
    filename: '008_expense_analyzer_narrative_cache.sql',
    isApplied: (db) => tableExists(db, 'expense_analyzer_narratives'),
  },
  {
    filename: '009_create_notifications.sql',
    isApplied: (db) => tableExists(db, 'notifications'),
  },
  {
    filename: '010_add_notification_preferences.sql',
    isApplied: (db) => columnExists(db, 'users', 'proactive_notifications_enabled'),
  },
  {
    filename: '011_add_monthly_budget.sql',
    isApplied: (db) => columnExists(db, 'users', 'monthly_budget'),
  },
  {
    filename: '012_create_savings_goals.sql',
    isApplied: (db) => tableExists(db, 'savings_goals'),
  },
  {
    filename: '013_create_monthly_trackers.sql',
    isApplied: (db) => tableExists(db, 'monthly_trackers'),
  },
  {
    filename: '014_saving_tracker_monthly_progress.sql',
    isApplied: (db) => columnExists(db, 'monthly_trackers', 'monthly_progress_amount'),
  },
  {
    filename: '015_unique_active_spending_tracker.sql',
    isApplied: (db) => indexExists(db, 'monthly_trackers_one_active_spending_per_user_idx'),
  },
  {
    filename: '016_spending_alert_thresholds.sql',
    isApplied: async (db) =>
      (await columnExists(db, 'monthly_trackers', 'alert_warning_percent')) &&
      (await columnExists(db, 'monthly_trackers', 'alert_remaining_dollars')),
  },
  {
    filename: '017_savings_transfer_detections.sql',
    isApplied: (db) => tableExists(db, 'savings_transfer_detections'),
  },
  {
    filename: '018_spending_cap_notification_types.sql',
    isApplied: (db) =>
      constraintDefinitionContains(db, 'notifications', 'notifications_trigger_type_check', [
        "'large_transaction'",
        "'low_balance'",
        "'new_recurring_charge'",
        "'spending_spike'",
        "'spending_cap_over'",
        "'spending_cap_warning'",
      ]),
  },
  {
    filename: '019_stripe_billing_columns.sql',
    isApplied: async (db) =>
      (await columnExists(db, 'users', 'stripe_customer_id')) &&
      (await columnExists(db, 'users', 'stripe_subscription_id')),
  },
  {
    filename: '020_category_soft_limits.sql',
    isApplied: (db) => tableExists(db, 'category_soft_limits'),
  },
  {
    filename: '021_plaid_external_item_id.sql',
    isApplied: (db) => columnExists(db, 'plaid_items', 'plaid_external_item_id'),
  },
  {
    filename: '022_user_payday.sql',
    isApplied: (db) => columnExists(db, 'users', 'next_payday_on'),
  },
  {
    filename: '023_action_lifecycle.sql',
    isApplied: (db) => columnExists(db, 'actions', 'status'),
  },
  {
    filename: '024_ritual_notification_types.sql',
    isApplied: (db) =>
      constraintDefinitionContains(db, 'notifications', 'notifications_trigger_type_check', [
        "'weekly_truth_letter'",
        "'month_condition_ready'",
      ]),
  },
  {
    filename: '025_stripe_cancel_at_period_end.sql',
    isApplied: async (db) =>
      (await columnExists(db, 'users', 'stripe_cancel_at_period_end')) &&
      (await columnExists(db, 'users', 'stripe_current_period_end')),
  },
  {
    filename: '026_ritual_notification_dedup_unique.sql',
    isApplied: (db) => indexExists(db, 'notifications_user_trigger_dedup_uidx'),
  },
  {
    filename: '027_plaid_webhook_events.sql',
    isApplied: (db) => tableExists(db, 'plaid_webhook_events'),
  },
  {
    filename: '028_chat_context_epoch.sql',
    isApplied: (db) => columnExists(db, 'users', 'chat_context_epoch'),
  },
  {
    filename: '029_stripe_webhook_events.sql',
    isApplied: (db) => tableExists(db, 'stripe_webhook_events'),
  },
  {
    filename: '030_drop_accounts_plaid_access_token.sql',
    isApplied: async (db) => !(await columnExists(db, 'accounts', 'plaid_access_token')),
  },
  {
    filename: '031_rate_limit_hits.sql',
    isApplied: (db) => tableExists(db, 'rate_limit_hits'),
  },
]

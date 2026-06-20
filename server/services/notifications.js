/*
 * NOTIFICATIONS SERVICE
 *
 * This file is for scheduled jobs (things that run automatically on a timer).
 * Right now it is a placeholder for future "daily financial insight" notifications.
 */

import cron from 'node-cron'

/*
 * scheduleFinancialInsightNotifications
 *
 * What it does:
 * - Sets up a daily job at 9:00 AM.
 * - Currently just logs a placeholder message.
 *
 * Why we need it:
 * - Later, this is where we can email or notify users about spending insights.
 *
 * How it fits the app:
 * - Server can call this once on startup to begin scheduled background work.
 */
export function scheduleFinancialInsightNotifications() {
  return cron.schedule('0 9 * * *', () => {
    console.log('Financial insight notification job placeholder ran')
  })
}

/*
 * MONTH-END CONDITION NOTIFY (email + in-app)
 *
 * M9: When a calendar month closes, tell the user their accountant letter
 * is ready — deep-link to /month-condition?month=YYYY-MM.
 */

import db from '../db/index.js'
import {
  getAppTodayIso,
  getCalendarMonthWindow,
  getPriorMonthKey,
  getZonedDateParts,
} from '../utils/calendarMonth.js'
import { buildMonthConditionLetterForUser } from './monthConditionLetter.js'
import { sendTransactionalEmail } from '../utils/transactionalEmail.js'
import { escapeHtml } from '../utils/escapeHtml.js'
import {
  insertRitualNotification,
  RITUAL_TRIGGER_TYPES,
} from '../utils/ritualNotifications.js'

function appBaseUrl(override) {
  return (override || process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/**
 * Pure: should we send the closed-month letter today?
 * Runs on day 1 of the new month (app timezone).
 */
export function shouldNotifyClosedMonth(referenceDate = new Date()) {
  const { day } = getZonedDateParts(referenceDate)
  return day === 1
}

export function closedMonthKeyForNotify(referenceDate = new Date()) {
  const window = getCalendarMonthWindow(referenceDate)
  return getPriorMonthKey(window.periodStart)
}

/**
 * Builds month-end notify payload for one user (prior closed month).
 */
export async function buildMonthConditionNotifyForUser(
  userId,
  { referenceDate = new Date(), appBaseUrl: baseOverride } = {}
) {
  const baseUrl = appBaseUrl(baseOverride)
  const monthKey = closedMonthKeyForNotify(referenceDate)

  const userResult = await db.query(
    `SELECT id, email, name, proactive_notifications_enabled, subscription_tier
     FROM users
     WHERE id = $1`,
    [userId]
  )
  const user = userResult.rows[0]
  if (!user) {
    return null
  }

  const letter = await buildMonthConditionLetterForUser(userId, {
    monthKey,
    referenceDate,
  }).catch(() => null)

  const monthLabel = letter?.monthLabel || monthKey
  const gradeId = letter?.condition?.grade
  const gradeLabel =
    letter?.condition?.title ||
    (gradeId === 'at_risk'
      ? 'Let’s finish strong'
      : gradeId === 'tight'
        ? 'Room to improve'
        : gradeId === 'stable'
          ? 'On track'
          : null)

  const summary =
    letter?.condition?.summary ||
    letter?.cashFlow?.summary ||
    `Your ${monthLabel} financial condition letter is ready to read.`

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    optedIn: user.proactive_notifications_enabled !== false,
    tier: user.subscription_tier ?? 'free',
    generatedAt: new Date().toISOString(),
    todayIso: getAppTodayIso(referenceDate),
    monthKey,
    monthLabel,
    gradeLabel,
    summary,
    links: {
      monthCondition: `${baseUrl}/month-condition?month=${monthKey}`,
      dashboard: `${baseUrl}/dashboard`,
      settings: `${baseUrl}/settings`,
    },
  }
}

export function formatMonthConditionNotifyEmail(payload) {
  const firstName = (payload.name || 'there').split(' ')[0]
  const gradeBit = payload.gradeLabel ? ` (${payload.gradeLabel})` : ''
  const subject = `Your ${payload.monthLabel} accountant letter is ready`

  const text = [
    `Hi ${firstName},`,
    '',
    `Your monthly accountant letter for ${payload.monthLabel} is ready${gradeBit}.`,
    '',
    payload.summary,
    '',
    `Read the letter: ${payload.links.monthCondition}`,
    '',
    '— Soverm',
  ].join('\n')

  const safeName = escapeHtml(firstName)
  const safeMonth = escapeHtml(payload.monthLabel)
  const safeGrade = escapeHtml(gradeBit)
  const safeSummary = escapeHtml(payload.summary)
  const safeLetter = escapeHtml(payload.links.monthCondition)
  const safeDashboard = escapeHtml(payload.links.dashboard)
  const safeSettings = escapeHtml(payload.links.settings)

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <p>Hi ${safeName},</p>
  <p>Your monthly accountant letter for <strong>${safeMonth}</strong> is ready${safeGrade}.</p>
  <p>${safeSummary}</p>
  <p>
    <a href="${safeLetter}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
      Read your letter
    </a>
  </p>
  <p style="color:#64748b;font-size:12px">
    <a href="${safeDashboard}">Dashboard</a> ·
    <a href="${safeSettings}">Notification settings</a>
  </p>
  <p style="color:#64748b;font-size:12px">— Soverm</p>
</body></html>`

  return { subject, text, html, to: payload.email }
}

async function createMonthConditionNotification(payload) {
  return insertRitualNotification({
    userId: payload.userId,
    triggerType: RITUAL_TRIGGER_TYPES.MONTH_CONDITION_READY,
    title: `Your ${payload.monthLabel} accountant letter is ready`,
    body: (payload.summary || '').slice(0, 280),
    relatedData: {
      link: `/month-condition?month=${payload.monthKey}`,
      monthKey: payload.monthKey,
    },
    dedupKey: `month_condition_ready:${payload.monthKey}`,
  })
}

export async function deliverMonthConditionNotifyForUser(userId, options = {}) {
  const payload = await buildMonthConditionNotifyForUser(userId, options)
  if (!payload) {
    return { delivered: false, reason: 'user_not_found' }
  }

  if (!payload.optedIn) {
    return { delivered: false, reason: 'opted_out' }
  }

  const notification = await createMonthConditionNotification(payload).catch((err) => {
    console.error(`[month-condition-notify] in-app failed for ${userId}:`, err.message)
    return { created: false, reason: 'notify_error' }
  })

  /*
   * Only email when this run created the in-app notification. Re-runs that
   * hit the dedup key must stay quiet so cron retries do not spam inboxes.
   */
  if (!notification?.created) {
    return {
      delivered: false,
      reason: notification?.reason ?? 'already_delivered',
      notificationCreated: false,
      payload,
    }
  }

  const formatted = formatMonthConditionNotifyEmail(payload)
  const result = await sendTransactionalEmail({
    ...formatted,
    logLabel: 'month-condition-notify',
  })

  return {
    delivered: Boolean(result.sent),
    notificationCreated: true,
    payload,
    ...result,
  }
}

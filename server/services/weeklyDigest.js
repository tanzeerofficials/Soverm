/*
 * WEEKLY TRUTH LETTER (email + in-app)
 *
 * T2.1 / T2.2: three bullets — what changed, what's at risk, one action —
 * deep-linked into Weekly Review. Elevates the old balance snapshot digest.
 */

import db from '../db/index.js'
import { buildWeeklyReviewForUser } from './weeklyReview.js'
import { sendTransactionalEmail } from '../utils/transactionalEmail.js'
import {
  insertRitualNotification,
  RITUAL_TRIGGER_TYPES,
} from '../utils/ritualNotifications.js'

function formatMoney(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return null
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount))
}

/**
 * Pure: turn a weekly-review payload into ICP truth-letter bullets.
 */
export function buildTruthLetterBullets(review) {
  const spent = formatMoney(review?.howYouDid?.spentThisWeek)
  const whatChanged =
    review?.howYouDid?.summary ||
    (spent != null
      ? `You spent ${spent} this week.`
      : 'We’re still learning your week — check in after a few more transactions.')

  const whatsAtRisk =
    review?.risk?.detail
      ? `${review.risk.title}: ${review.risk.detail}`
      : review?.risk?.title || 'No major risk flagged — still worth a quick look.'

  const oneAction =
    review?.move?.detail
      ? `${review.move.title}: ${review.move.detail}`
      : review?.move?.title || 'Open Your week and pick one small better move.'

  return { whatChanged, whatsAtRisk, oneAction }
}

function appBaseUrl(override) {
  return (override || process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/**
 * Builds the weekly truth-letter payload for one user.
 */
export async function buildWeeklyDigestForUser(userId, { appBaseUrl: baseOverride } = {}) {
  const baseUrl = appBaseUrl(baseOverride)

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

  const review = await buildWeeklyReviewForUser(userId).catch(() => null)
  const bullets = buildTruthLetterBullets(review)
  const weekStartIso = review?.week?.weekStartIso ?? null
  const weekLabel = review?.week?.label ?? 'This week'

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    optedIn: user.proactive_notifications_enabled !== false,
    tier: user.subscription_tier ?? 'free',
    generatedAt: new Date().toISOString(),
    weekLabel,
    weekStartIso,
    bullets,
    // Keep a slim highlights bag for debugging / future templates
    highlights: {
      spentThisWeek: review?.howYouDid?.spentThisWeek ?? null,
      whatsLeft: review?.whatsLeft?.amount ?? null,
      runwayVerdict: review?.runwayCoach?.verdict ?? null,
      riskTitle: review?.risk?.title ?? null,
      moveTitle: review?.move?.title ?? null,
    },
    links: {
      weeklyReview: `${baseUrl}/weekly-review`,
      dashboard: `${baseUrl}/dashboard`,
      settings: `${baseUrl}/settings`,
    },
  }
}

/**
 * Turns a truth-letter payload into email subject + text/html.
 */
export function formatWeeklyDigestEmail(digest) {
  const firstName = (digest.name || 'there').split(' ')[0]
  const b = digest.bullets ?? {}
  const subject = `Your week: ${digest.weekLabel || 'Soverm check-in'}`

  const lines = [
    `Hi ${firstName},`,
    '',
    `Here’s your Soverm truth letter for ${digest.weekLabel || 'this week'}:`,
    '',
    `1. What changed — ${b.whatChanged}`,
    `2. What’s at risk — ${b.whatsAtRisk}`,
    `3. One action — ${b.oneAction}`,
    '',
    `Open Your week: ${digest.links.weeklyReview}`,
    '',
    '— Soverm',
  ]

  const text = lines.join('\n')

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
  <p>Hi ${firstName},</p>
  <p>Here’s your Soverm truth letter for <strong>${digest.weekLabel || 'this week'}</strong>:</p>
  <ol>
    <li><strong>What changed</strong> — ${b.whatChanged}</li>
    <li><strong>What’s at risk</strong> — ${b.whatsAtRisk}</li>
    <li><strong>One action</strong> — ${b.oneAction}</li>
  </ol>
  <p>
    <a href="${digest.links.weeklyReview}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
      Open Your week
    </a>
  </p>
  <p style="color:#64748b;font-size:12px">
    <a href="${digest.links.dashboard}">Dashboard</a> ·
    <a href="${digest.links.settings}">Notification settings</a>
  </p>
  <p style="color:#64748b;font-size:12px">— Soverm</p>
</body></html>`

  return { subject, text, html, to: digest.email }
}

export async function sendWeeklyDigestEmail(formatted) {
  return sendTransactionalEmail({ ...formatted, logLabel: 'weekly-digest' })
}

async function createWeeklyTruthNotification(digest) {
  if (!digest?.weekStartIso) {
    return { created: false, reason: 'missing_week' }
  }

  const body = [
    digest.bullets?.whatChanged,
    digest.bullets?.whatsAtRisk,
    digest.bullets?.oneAction,
  ]
    .filter(Boolean)
    .join(' ')

  return insertRitualNotification({
    userId: digest.userId,
    triggerType: RITUAL_TRIGGER_TYPES.WEEKLY_TRUTH_LETTER,
    title: `Your week is ready · ${digest.weekLabel}`,
    body: body.slice(0, 280),
    relatedData: {
      link: '/weekly-review',
      weekStartIso: digest.weekStartIso,
    },
    dedupKey: `weekly_truth_letter:${digest.weekStartIso}`,
  })
}

export async function deliverWeeklyDigestForUser(userId) {
  const digest = await buildWeeklyDigestForUser(userId)
  if (!digest) {
    return { delivered: false, reason: 'user_not_found' }
  }

  if (!digest.optedIn) {
    return { delivered: false, reason: 'opted_out' }
  }

  const notification = await createWeeklyTruthNotification(digest).catch((err) => {
    console.error(`[weekly-digest] in-app notify failed for ${userId}:`, err.message)
    return { created: false, reason: 'notify_error' }
  })

  const formatted = formatWeeklyDigestEmail(digest)
  const result = await sendWeeklyDigestEmail(formatted)
  return {
    delivered: Boolean(result.sent),
    notificationCreated: Boolean(notification?.created),
    digest,
    ...result,
  }
}

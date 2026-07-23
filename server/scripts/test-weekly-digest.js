/**
 * Unit-style checks for weekly truth-letter formatting (no DB required).
 *
 * Usage: node scripts/test-weekly-digest.js
 */

import {
  buildTruthLetterBullets,
  formatWeeklyDigestEmail,
} from '../services/weeklyDigest.js'
import { test } from 'node:test'

test('weekly digest', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('weekly truth letter tests\n')

  const bullets = buildTruthLetterBullets({
    howYouDid: {
      spentThisWeek: 412.5,
      summary: 'You spent $412.50 this week — a bit under last week.',
    },
    risk: {
      title: 'Runway is tight',
      detail: 'What’s left until payday is under $100 after known bills.',
    },
    move: {
      title: 'Pause one subscription',
      detail: 'Cancel or watch Netflix before the next charge.',
    },
  })

  assert(bullets.whatChanged.includes('412.50') || bullets.whatChanged.includes('under'), 'what changed')
  assert(bullets.whatsAtRisk.includes('tight'), 'whats at risk')
  assert(bullets.oneAction.includes('Pause'), 'one action')

  const sample = {
    userId: 'user_test',
    email: 'alex@example.com',
    name: 'Alex Rivera',
    optedIn: true,
    tier: 'free',
    generatedAt: new Date().toISOString(),
    weekLabel: 'Jul 6–12',
    weekStartIso: '2026-07-06',
    bullets,
    highlights: {},
    links: {
      weeklyReview: 'http://localhost:5173/weekly-review',
      dashboard: 'http://localhost:5173/dashboard',
      settings: 'http://localhost:5173/settings',
    },
  }

  const formatted = formatWeeklyDigestEmail(sample)

  assert(formatted.to === 'alex@example.com', 'recipient email')
  assert(formatted.subject.includes('Jul 6–12'), 'subject includes week')
  assert(formatted.text.includes('What changed'), 'text has what changed')
  assert(formatted.text.includes('What’s at risk') || formatted.text.includes("What's at risk"), 'text has risk')
  assert(formatted.text.includes('One action'), 'text has action')
  assert(formatted.text.includes('/weekly-review'), 'deep-links weekly review')
  assert(formatted.html.includes('Open Your week'), 'html CTA')
  assert(formatted.html.includes('/weekly-review'), 'html deep-link')

  const xssSample = {
    ...sample,
    name: 'Alex',
    weekLabel: 'Jul 6–12 & friends',
    bullets: {
      whatChanged: 'Spent <script>alert(1)</script> more',
      whatsAtRisk: 'Risk & reward',
      oneAction: "Don't skip rent",
    },
  }
  const xssHtml = formatWeeklyDigestEmail(xssSample).html
  assert(!xssHtml.includes('<script>'), 'html escapes script tags')
  assert(xssHtml.includes('&lt;script&gt;'), 'script becomes entities')
  assert(xssHtml.includes('&amp;'), 'ampersands escaped in html')
  assert(xssHtml.includes('Don&#39;t'), 'apostrophe escaped')

  console.log('test-weekly-digest: ok')
})

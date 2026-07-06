import Anthropic from '@anthropic-ai/sdk'
import db from '../db/index.js'
import {
  buildExpenseAnalyzerNarrativeBrief,
  fingerprintExpenseAnalyzerBrief,
} from '../utils/expenseAnalyzerNarrativeBrief.js'
import { validatePersonalNarrative } from '../utils/expenseAnalyzerNarrativeValidation.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const NARRATIVE_SYSTEM_PROMPT = `You are Soverm, a personal AI CFO writing a short spending summary for the Expense Analyzer page.

Respond ONLY with valid JSON — no markdown fences, no text before or after.

Your job is to explain pre-computed figures in plain English. You must never invent merchants, categories, dollar amounts, or subscription counts.

Terminology (use exactly):
- "Confirmed recurring" = subscriptions we are confident about — these count toward the confirmed recurring monthly total
- "Review" = uncertain patterns — explicitly say they are NOT included in the confirmed recurring total
- "One-time" = non-subscription spend in the last 30 days

Tone: direct, calm, helpful — like a trusted CFO briefing, not marketing copy or alarmist language.

Do not give numbered action steps — weekly insights cover actions. This is an explanation of the current breakdown only.`

function parseNarrativeJson(rawText) {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()

  return JSON.parse(cleaned)
}

function buildUserPrompt(brief) {
  return `Write a personalized spending summary using ONLY this JSON brief:

${JSON.stringify(brief, null, 2)}

Return ONLY this JSON shape:
{
  "lead": "One sentence (max 22 words) capturing the most important takeaway — use exact dollar figures from the brief when mentioning totals",
  "paragraphs": [
    "Paragraph 1 (35-55 words): What changed overall — overall spending direction, and whether the shift is mostly one-time or confirmed recurring",
    "Paragraph 2 (35-55 words): The top category mover OR the biggest category, with recurring vs one-time split when relevant",
    "Paragraph 3 (optional, 25-45 words): Confirmed recurring — when confirmedRecurring is non-empty, mention confirmedRecurringAnnual as an annual total in natural prose (e.g. subscriptions add up to $X a year), and you may also reference confirmedRecurringMonthly; include merchant names if helpful. If reviewItems exist, clearly separate them and say they are not counted in confirmed recurring"
  ]
}

Rules:
- Use exact figures from the brief (you may format with $ and commas)
- When confirmedRecurring is non-empty, the recurring paragraph must mention confirmedRecurringAnnual at least once as a yearly total
- Keep recurring framing factual — do not compare annual totals to unrelated purchases (flights, gadgets, etc.)
- If reviewItems is non-empty, you MUST mention Review items separately from confirmed recurring
- If confirmedRecurring is empty, do not imply subscriptions exist
- Compare using "${brief.periodLabel}" — never say "last month" (calendar month)
- paragraphs must contain 2 items if no confirmed recurring and no review; otherwise 2-3 items
- Do not mention merchants unless they appear in confirmedRecurring, reviewItems, or topCategories`
}

export async function generatePersonalNarrativeWithClaude(brief) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 700,
    system: NARRATIVE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(brief),
      },
    ],
  })

  const rawText = response.content[0]?.text
  if (!rawText) {
    throw new Error('Claude returned an empty narrative response')
  }

  const parsed = parseNarrativeJson(rawText)
  const validation = validatePersonalNarrative({
    paragraphs: parsed.paragraphs,
    lead: parsed.lead,
    brief,
  })

  if (!validation.valid) {
    throw new Error(`Narrative validation failed: ${validation.reason}`)
  }

  return {
    lead: parsed.lead.trim(),
    paragraphs: parsed.paragraphs.map((paragraph) => paragraph.trim()),
  }
}

async function readCachedNarrative(userId, fingerprint) {
  try {
    const result = await db.query(
      `SELECT lead, paragraphs, created_at
       FROM expense_analyzer_narratives
       WHERE user_id = $1 AND payload_fingerprint = $2`,
      [userId, fingerprint]
    )

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    return {
      lead: row.lead,
      paragraphs: row.paragraphs,
      generatedAt: row.created_at,
      source: 'cache',
    }
  } catch (err) {
    if (err.code === '42P01') {
      return null
    }

    throw err
  }
}

async function writeCachedNarrative(userId, fingerprint, narrative) {
  try {
    await db.query(
      `INSERT INTO expense_analyzer_narratives (
         user_id, payload_fingerprint, lead, paragraphs
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, payload_fingerprint)
       DO UPDATE SET
         lead = EXCLUDED.lead,
         paragraphs = EXCLUDED.paragraphs,
         created_at = NOW()`,
      [userId, fingerprint, narrative.lead, JSON.stringify(narrative.paragraphs)]
    )
  } catch (err) {
    if (err.code === '42P01') {
      return
    }

    throw err
  }
}

export async function getPersonalNarrativeStatus(userId, payload) {
  const brief = buildExpenseAnalyzerNarrativeBrief(payload)
  const fingerprint = fingerprintExpenseAnalyzerBrief(brief)
  const cached = await readCachedNarrative(userId, fingerprint)

  return {
    fingerprint,
    cached: Boolean(cached),
    narrative: cached,
  }
}

export async function loadOrGeneratePersonalNarrative(userId, payload) {
  const brief = buildExpenseAnalyzerNarrativeBrief(payload)
  const fingerprint = fingerprintExpenseAnalyzerBrief(brief)
  const cached = await readCachedNarrative(userId, fingerprint)

  if (cached) {
    return {
      fingerprint,
      ...cached,
    }
  }

  const generated = await generatePersonalNarrativeWithClaude(brief)
  const narrative = {
    lead: generated.lead,
    paragraphs: generated.paragraphs,
    generatedAt: new Date().toISOString(),
    source: 'generated',
  }

  await writeCachedNarrative(userId, fingerprint, narrative)

  return {
    fingerprint,
    ...narrative,
  }
}

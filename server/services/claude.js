/*
 * CLAUDE (AI) CLIENT SETUP
 *
 * This file connects to Anthropic's API so we can turn raw
 * transaction data into structured financial insights.
 *
 * Environment variables used here:
 * - ANTHROPIC_API_KEY -> secret key for Anthropic API access
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  buildCategoryBreakdownFromComparison,
  computeSpendingDelta,
  formatComparisonPhrase,
  formatMoneyAmount,
} from '../utils/financialContext.js'
import { buildExpenseAnalyzerChatContextFromPayload } from '../utils/expenseAnalyzerChatContext.js'
import { classifyCashFlowTransaction } from '../utils/transactionFilters.js'
import {
  CHAT_LOOKUP_TOOLS,
  buildChatToolsPromptHint,
  executeChatLookupTool,
  formatChatLookupStatus,
} from '../utils/chatLookupTools.js'

export { buildExpenseAnalyzerChatContextFromPayload }

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CHAT_MAX_TOOL_ROUNDS = 3

const SYSTEM_PROMPT = `You are Soverm, a personal AI CFO who genuinely cares about this person — not a report generator. You analyze financial data and respond ONLY with valid JSON, nothing else — no markdown code blocks, no explanation text before or after, just the raw JSON object.

Accuracy first: every dollar amount, percentage, merchant, and recommendation must stay grounded in the data provided. Warmth never means vagueness or inventing figures.

TONE — caring advisor, still honest:
- Product goal: help people track money and take useful next steps. Leave them informed and capable — never shamed or panicked.
- When the picture is genuinely concerning (tight cash, a real spending jump, rising debt), open fullSummary paragraph 1 by acknowledging that human reality in one plain, warm sentence ("Things are tight right now" / "This jumped vs last month — let's see why") before the analysis. Skip that acknowledgment for routine or positive check-ins — do not manufacture drama.
- Avoid clinical or dramatic framing of numbers. Prefer "your medical spending is higher this month — about $887 vs $100 before" over scare multipliers ("9×") or "surged 787%." Lead with plain language and dollars; never headline with multipliers or percent drama.
- Hard news stays direct — never sugarcoat — but pair it with capability, not alarm: "you're capable of fixing this, here's exactly how," not "here's how bad this is."
- Avoid panic words: crisis, dug a hole, spending spike (as scare), fastest-growing. Prefer: worth a quick look, needs attention, here's one next step.
- End fullSummary paragraph 3 on forward motion: after the concrete recommendation, close with a brief note of encouragement or perspective so they feel relieved and capable, not lectured.
- Match tone to real severity. Healthy cushion + routine question → light and easy. Genuine cash crunch → warm and direct — not panic, not false reassurance.
- When something is ambiguous (is a subscription worth keeping, is a large transfer intentional), prefer an action that asks a genuine curious question rather than assuming.

Critical cash-flow rules:
- Overall income and spending totals are pre-computed. Never re-sum them from the transaction list.
- Rows are tagged with a specific kind. SELF_TRANSFER and LIABILITY_PAYMENT must not be treated as income or discretionary spending.
- SELF_DEPOSIT (ATM / check / mobile deposit) and PEER_IN (Zelle, Venmo, etc.) count as real money in. PEER_OUT and CASH_OUT count as real money out.
- Never call something a vague "transfer" when a specific tag is present.`

function extractJsonObject(text) {
  const start = text.indexOf('{')
  if (start === -1) {
    throw new Error('No JSON object found in response')
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const char = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\' && inString) {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  throw new Error('Unclosed JSON object in response')
}

function parseClaudeJson(rawText) {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // Claude sometimes appends text after valid JSON — extract the first object only.
    return JSON.parse(extractJsonObject(cleaned))
  }
}

/*
 * generateFinancialSummary(transactions, accountSummary)
 *
 * What it does:
 * - Formats recent transactions into readable text
 * - Sends them to Claude with a fixed "CFO" personality
 * - Parses and returns a structured JSON insight object
 *
 * Why we need it:
 * - Raw transaction rows are hard to interpret; users want insight, not spreadsheets
 *
 * How it fits the app:
 * - A dashboard or insights route loads transactions from Postgres,
 *   calls this function, and shows the summary to the user
 */
export async function generateFinancialSummary(
  transactions,
  accountSummary,
  monthOverMonthComparison = null,
  expenseAnalyzerContext = null
) {
  const formattedTransactions = formatTransactions(transactions)
  const { block: monthOverMonthBlock, instruction: monthOverMonthInstruction } =
    buildMonthOverMonthPromptContext(monthOverMonthComparison)
  const { block: expenseAnalyzerBlock, instruction: expenseAnalyzerInstruction } =
    buildExpenseAnalyzerPromptBlock(expenseAnalyzerContext)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is recent financial activity:

${formattedTransactions}

Account balances:
${accountSummary}${monthOverMonthBlock}${expenseAnalyzerBlock}

Respond with ONLY this exact JSON structure, no other text:

{
  "headline": "One punchy, human sentence (max 15 words) capturing the single most important thing about this person's finances right now — warm and plain, not clinical or dramatic; can be a warning, a win, or a key fact",
  "headlineType": "warning" or "positive" or "neutral",
  "stats": [
    {
      "label": "short 2-3 word label",
      "value": "the key number, formatted with $ if money",
      "detail": "one short sentence of context, max 12 words — plain language, not alarmist",
      "statType": "spending" or "income" or "neutral",
      "delta": {
        "direction": "up" or "down" or "flat" or null,
        "percent": 18,
        "times": 1.18,
        "absoluteChange": 142,
        "currentTotal": 842,
        "priorTotal": 700,
        "vsLabel": "vs prior 30 days"
      }
    },
    (exactly 3 stat objects total, covering: biggest expense, a debt/risk metric if relevant OR income highlight, and liquid cash position)
  ],
  "fullSummary": [
    "Paragraph 1 (40-60 words): The Situation — if concerning, open with one warm acknowledgment sentence, then describe their position in plain language with real numbers supporting the story (not leading it)",
    "Paragraph 2 (40-60 words): The Risk or Pattern — the single most important risk, habit, or pattern; honest and specific, framed as fixable, not catastrophic",
    "Paragraph 3 (35-55 words): The Move — one clear, specific action with numbers, then a brief forward-looking close that leaves them feeling capable and relieved"
  ],
  "actions": [
    "specific action with a number if possible, max 15 words",
    "specific action with a number if possible, max 15 words",
    "specific action with a number if possible, max 15 words — may be a genuine clarifying question when something is ambiguous"
  ]
}

Each stat object must include "statType" and a "delta" field. Set statType to "income" for income/paycheck/deposit stats, "neutral" for cash balances, debt ratios, or other non-spend metrics, and "spending" for expense categories and overall spending. Use the pre-computed delta values provided above when the stat matches overall spending or a listed category; otherwise set "delta": null. Do not calculate percentages yourself. In narrative copy, prefer calm dollar framing (e.g. "$842 this period (was $700 before)") — never lead with times-multipliers or percent scare headlines.

fullSummary must be an array of exactly 3 strings. Each string is a complete standalone paragraph. Do not use line breaks within a single string — each paragraph is its own array element. Write like a caring advisor: plain language first, real numbers as support, tone matched to severity, and a capable forward close in paragraph 3.${monthOverMonthInstruction}${expenseAnalyzerInstruction}

actions must be an array of exactly 3 strings. Each one is a specific, concrete next step the person can take this week. Use real numbers from their data when relevant. Order from most urgent/impactful to least. When something important is ambiguous, one action may be a genuine clarifying question.`,
        },
      ],
    })

    const rawText = response.content[0].text

    try {
      const parsed = parseClaudeJson(rawText)
      return enforceStatDeltas(parsed, monthOverMonthComparison)
    } catch (parseErr) {
      console.error('Failed to parse Claude JSON response:', rawText)
      throw new Error(`Claude returned invalid JSON: ${parseErr.message}`)
    }
  } catch (err) {
    console.error('Failed to generate financial summary:', err.message)
    throw new Error(`Claude financial summary failed: ${err.message}`)
  }
}

function formatTransactions(transactions) {
  return transactions
    .map((t) => {
      const kind = classifyCashFlowTransaction(t)
      const kindTag = kind ? ` | ${String(kind).toUpperCase()}` : ''
      const note =
        kind === 'self_transfer' || kind === 'liability_payment'
          ? ' (do not count as income or spend)'
          : ''
      return `${t.date} | ${t.name} | $${t.amount} | ${t.category || 'Uncategorized'}${kindTag}${note}`
    })
    .join('\n')
}

export function buildExpenseAnalyzerPromptBlock(expenseAnalyzerContext) {
  if (!expenseAnalyzerContext) {
    return { block: '', instruction: '' }
  }

  const {
    topMover,
    recurringCharges = [],
    totalRecurringMonthly = 0,
    overallSpending,
  } = expenseAnalyzerContext

  const lines = []

  if (overallSpending?.delta) {
    const { direction } = overallSpending.delta
    const phrase = formatComparisonPhrase(
      overallSpending.currentTotal,
      overallSpending.priorTotal,
      {
        ...overallSpending.delta,
        isNewCategory: overallSpending.delta.percent == null && direction === 'up',
      }
    )
    lines.push(`Overall spending: ${phrase}`)
  }

  if (topMover?.isNewCategory && topMover.currentTotal != null) {
    lines.push(
      `Category note (new this period): ${topMover.category} — ${formatMoneyAmount(topMover.currentTotal)} now, $0 in the prior period`
    )
  } else if (topMover?.percent != null && topMover.direction !== 'flat' && topMover.percent >= 5) {
    const moneyBit =
      topMover.currentTotal != null && topMover.priorTotal != null
        ? ` — ${formatMoneyAmount(topMover.currentTotal)} this period vs ${formatMoneyAmount(topMover.priorTotal)} prior`
        : ''
    const tone =
      topMover.direction === 'up'
        ? 'worth a quick look (not a crisis)'
        : 'quieter than the prior period'
    lines.push(`Category note (${tone}): ${topMover.category}${moneyBit}`)
  }

  if (recurringCharges.length > 0) {
    lines.push(
      `Detected recurring charges: ${recurringCharges.length} totaling about $${totalRecurringMonthly}/mo`
    )

    for (const charge of recurringCharges.slice(0, 5)) {
      const accountSuffix = charge.accountLabel ? `, account: ${charge.accountLabel}` : ''
      lines.push(
        `- ${charge.merchant}: $${charge.averageAmount} (${charge.cadence}, category: ${charge.category}${accountSuffix})`
      )
    }
  }

  if (lines.length === 0) {
    return { block: '', instruction: '' }
  }

  return {
    block: `

Pre-computed expense analyzer signals:
${lines.join('\n')}`,
    instruction: `

When relevant, reference detected recurring charges or the top category mover in fullSummary or actions. Use only the figures above — do not invent subscription amounts.`,
  }
}

const MONTH_OVER_MONTH_VS_LABEL = 'vs prior 30 days'

const OVERALL_SPENDING_MATCH_TERMS = [
  'overall spending',
  'total spending',
  'total spend',
  'monthly spending',
  'spending',
  'expenses',
  'total expenses',
  'monthly expenses',
  'outflow',
]

const OVERALL_INCOME_MATCH_TERMS = [
  'overall income',
  'total income',
  'monthly income',
  'income',
  'earned',
  'paycheck',
  'paychecks',
  'salary',
  'wages',
  'deposits',
  'revenue',
]

// Words in the same inner array are treated as related for fuzzy stat-to-category matching.
const RELATED_WORD_GROUPS = [
  ['dining', 'food', 'drink', 'restaurant', 'restaurants', 'eating', 'meals', 'groceries', 'grocery'],
  ['transport', 'transportation', 'travel', 'commute', 'gas', 'fuel', 'uber', 'lyft', 'parking'],
  ['shopping', 'retail', 'merchandise', 'amazon'],
  ['entertainment', 'streaming', 'subscriptions', 'media', 'games'],
  ['bills', 'utilities', 'rent', 'housing', 'mortgage', 'insurance'],
  ['health', 'medical', 'healthcare', 'pharmacy', 'doctor'],
  ['income', 'paycheck', 'salary', 'wages', 'deposit'],
  ['cash', 'liquid', 'savings', 'balance', 'checking'],
]

const MIN_DELTA_MATCH_SCORE = 50

const INCOME_STAT_TERMS = [
  'income',
  'earned',
  'deposit',
  'salary',
  'paycheck',
  'wages',
  'revenue',
  'pay',
]

const NEUTRAL_STAT_TERMS = [
  'cash',
  'liquid',
  'balance',
  'savings',
  'checking',
  'debt',
  'credit',
  'utilization',
  'net worth',
]

const SPENDING_STAT_TERMS = [
  'spending',
  'expense',
  'expenses',
  'spend',
  'outflow',
  'dining',
  'shopping',
  'bills',
  'transport',
]

function statTextBlob(stat) {
  return normalizeMatchText([stat?.label, stat?.detail, stat?.value].filter(Boolean).join(' '))
}

function textMatchesAnyTerm(text, terms) {
  return terms.some((term) => {
    if (term.includes(' ')) {
      return text.includes(term)
    }

    const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    return pattern.test(text)
  })
}

export function inferStatType(stat) {
  const text = statTextBlob(stat)

  if (!text) {
    return 'spending'
  }

  if (textMatchesAnyTerm(text, INCOME_STAT_TERMS)) {
    return 'income'
  }

  if (textMatchesAnyTerm(text, NEUTRAL_STAT_TERMS)) {
    return 'neutral'
  }

  if (textMatchesAnyTerm(text, SPENDING_STAT_TERMS)) {
    return 'spending'
  }

  return 'spending'
}

function normalizeMatchText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeMatchText(text) {
  return normalizeMatchText(text)
    .split(' ')
    .filter((word) => word.length > 1)
}

function wordsAreRelated(wordA, wordB) {
  const a = normalizeMatchText(wordA)
  const b = normalizeMatchText(wordB)

  if (!a || !b) {
    return false
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true
  }

  return RELATED_WORD_GROUPS.some(
    (group) =>
      group.some((term) => a.includes(term) || term.includes(a)) &&
      group.some((term) => b.includes(term) || term.includes(b))
  )
}

function scoreTextAgainstTerms(text, terms) {
  const normalized = normalizeMatchText(text)
  if (!normalized) {
    return 0
  }

  let bestScore = 0

  for (const term of terms) {
    const normalizedTerm = normalizeMatchText(term)
    if (!normalizedTerm) {
      continue
    }

    if (normalized === normalizedTerm) {
      bestScore = Math.max(bestScore, 100)
      continue
    }

    if (normalized.includes(normalizedTerm) || normalizedTerm.includes(normalized)) {
      bestScore = Math.max(bestScore, 85)
      continue
    }

    const textTokens = tokenizeMatchText(normalized)
    const termTokens = tokenizeMatchText(normalizedTerm)
    let relatedTokenHits = 0

    for (const textToken of textTokens) {
      for (const termToken of termTokens) {
        if (wordsAreRelated(textToken, termToken)) {
          relatedTokenHits++
        }
      }
    }

    if (relatedTokenHits > 0) {
      const overlapRatio =
        relatedTokenHits / Math.max(textTokens.length, termTokens.length, 1)
      bestScore = Math.max(bestScore, 50 + overlapRatio * 35)
    }
  }

  return bestScore
}

function buildPrecomputedDeltaEntries(monthOverMonthComparison) {
  if (!monthOverMonthComparison?.hasComparisonData) {
    return []
  }

  const { currentPeriod, priorPeriod } = monthOverMonthComparison
  const entries = []

  const spendingTotalDelta = computeSpendingDelta(
    currentPeriod.spending.total,
    priorPeriod.spending.total
  )
  entries.push({
    kind: 'overall',
    label: 'Overall spending',
    matchTerms: OVERALL_SPENDING_MATCH_TERMS,
    delta: toStatDelta(
      spendingTotalDelta,
      currentPeriod.spending.total,
      priorPeriod.spending.total
    ),
  })

  const incomeTotalDelta = computeSpendingDelta(
    currentPeriod.income.total,
    priorPeriod.income.total
  )
  entries.push({
    kind: 'income',
    label: 'Overall income',
    matchTerms: OVERALL_INCOME_MATCH_TERMS,
    delta: toStatDelta(
      incomeTotalDelta,
      currentPeriod.income.total,
      priorPeriod.income.total
    ),
  })

  for (const { category, currentTotal, priorTotal, spendingDelta } of buildCategoryBreakdownFromComparison(
    monthOverMonthComparison
  )) {
    entries.push({
      kind: 'category',
      label: category,
      matchTerms: [category, ...tokenizeMatchText(category)],
      delta: toStatDelta(spendingDelta, currentTotal, priorTotal),
    })
  }

  return entries
}

function findPrecomputedDeltaForStat(stat, entries, statType) {
  if (!stat || entries.length === 0 || statType === 'neutral') {
    return null
  }

  const eligibleKinds = statType === 'income' ? ['income'] : ['overall', 'category']
  const eligibleEntries = entries.filter((entry) => eligibleKinds.includes(entry.kind))

  const statTexts = [stat.label, stat.detail, stat.value].filter(Boolean)
  let bestMatch = null

  for (const entry of eligibleEntries) {
    let entryScore = 0

    for (const statText of statTexts) {
      entryScore = Math.max(entryScore, scoreTextAgainstTerms(statText, entry.matchTerms))
    }

    if (!bestMatch || entryScore > bestMatch.score) {
      bestMatch = { entry, score: entryScore }
    }
  }

  if (!bestMatch || bestMatch.score < MIN_DELTA_MATCH_SCORE) {
    return null
  }

  return bestMatch.entry.delta
}

const isEnforcementDebugEnabled = () => process.env.NODE_ENV !== 'production'

function deltasEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function logEnforcementOverride(statLabel, field, claudeValue, enforcedValue) {
  if (!isEnforcementDebugEnabled()) {
    return
  }

  console.debug(
    `[enforceStatDeltas] "${statLabel}" ${field} override:`,
    { from: claudeValue ?? null, to: enforcedValue ?? null }
  )
}

export function enforceStatDeltas(insight, monthOverMonthComparison) {
  if (!insight || !Array.isArray(insight.stats)) {
    return insight
  }

  const entries = buildPrecomputedDeltaEntries(monthOverMonthComparison)

  return {
    ...insight,
    stats: insight.stats.map((stat) => {
      const enforcedStatType = inferStatType(stat)
      const enforcedDelta = findPrecomputedDeltaForStat(stat, entries, enforcedStatType)
      const statLabel = stat.label || '(unlabeled stat)'

      if (stat.statType !== enforcedStatType) {
        logEnforcementOverride(statLabel, 'statType', stat.statType, enforcedStatType)
      }

      if (!deltasEqual(stat.delta, enforcedDelta)) {
        logEnforcementOverride(statLabel, 'delta', stat.delta, enforcedDelta)
      }

      return {
        ...stat,
        statType: enforcedStatType,
        delta: enforcedDelta,
      }
    }),
  }
}

const INSIGHT_COMPARISON_WINDOW = '30d'

function snapshotMonthOverMonthComparison(monthOverMonthComparison) {
  if (!monthOverMonthComparison) {
    return null
  }

  return {
    hasComparisonData: Boolean(monthOverMonthComparison.hasComparisonData),
    currentPeriod: {
      spending: {
        total: Number(monthOverMonthComparison.currentPeriod?.spending?.total ?? 0),
        byCategory: {
          ...(monthOverMonthComparison.currentPeriod?.spending?.byCategory ?? {}),
        },
      },
      income: {
        total: Number(monthOverMonthComparison.currentPeriod?.income?.total ?? 0),
      },
    },
    priorPeriod: {
      spending: {
        total: Number(monthOverMonthComparison.priorPeriod?.spending?.total ?? 0),
        byCategory: {
          ...(monthOverMonthComparison.priorPeriod?.spending?.byCategory ?? {}),
        },
      },
      income: {
        total: Number(monthOverMonthComparison.priorPeriod?.income?.total ?? 0),
      },
    },
    capturedAt: new Date().toISOString(),
  }
}

/*
 * buildPersistedInsightContent(insight, monthOverMonthComparison, { transactionCount, generatedAt })
 *
 * Packages the enforced insight fields plus a frozen MoM snapshot and generation
 * metadata for storage. History and chat read this JSON later — they must not
 * recompute deltas from live transaction data.
 */
export function buildPersistedInsightContent(
  insight,
  monthOverMonthComparison,
  { transactionCount = 0, generatedAt = new Date().toISOString() } = {}
) {
  if (!insight || typeof insight !== 'object') {
    return insight
  }

  return {
    headline: insight.headline,
    headlineType: insight.headlineType,
    stats: Array.isArray(insight.stats) ? insight.stats : [],
    fullSummary: insight.fullSummary,
    actions: Array.isArray(insight.actions) ? insight.actions : [],
    monthOverMonthComparison: snapshotMonthOverMonthComparison(monthOverMonthComparison),
    metadata: {
      generatedAt,
      transactionCount: Number(transactionCount),
      comparisonWindow: INSIGHT_COMPARISON_WINDOW,
    },
  }
}

function toStatDelta(delta, current = null, prior = null) {
  if (!delta) {
    return null
  }

  if (delta.isNewCategory) {
    return {
      direction: 'up',
      percent: null,
      times: null,
      absoluteChange: current != null ? Math.abs(Number(current) || 0) : delta.absoluteChange ?? null,
      currentTotal: current,
      priorTotal: prior ?? 0,
      vsLabel: MONTH_OVER_MONTH_VS_LABEL,
    }
  }

  const currentTotal = current != null ? Number(current) : null
  const priorTotal = prior != null ? Number(prior) : null
  const times =
    delta.times ??
    (priorTotal > 0 && currentTotal != null ? Math.round((currentTotal / priorTotal) * 100) / 100 : null)
  const absoluteChange =
    delta.absoluteChange ??
    (currentTotal != null && priorTotal != null
      ? Math.round(Math.abs(currentTotal - priorTotal) * 100) / 100
      : null)

  return {
    direction: delta.direction,
    percent: delta.percent,
    times,
    absoluteChange,
    currentTotal,
    priorTotal,
    vsLabel: MONTH_OVER_MONTH_VS_LABEL,
  }
}

function formatDeltaForPrompt(category, current, prior, delta, { metric = 'spending' } = {}) {
  if (delta.isNewCategory) {
    if (metric === 'income') {
      return `- ${category}: new income this period (${formatMoneyAmount(current)} this period, $0 in the prior period)`
    }

    return `- ${category}: new spending category (${formatMoneyAmount(current)} this period, $0 in the prior period)`
  }

  return `- ${category}: ${formatComparisonPhrase(current, prior, delta, {
    vsLabel: MONTH_OVER_MONTH_VS_LABEL,
  })}`
}

function buildMonthOverMonthPromptContext(monthOverMonthComparison) {
  if (!monthOverMonthComparison?.hasComparisonData) {
    return {
      block: `

Not enough history yet for a month-over-month comparison. Do not reference any month-over-month, prior-period, or "down/up X%" comparison in the headline, stats, or fullSummary. Set "delta": null on every stat object.`,
      instruction: '',
    }
  }

  const { currentPeriod, priorPeriod } = monthOverMonthComparison
  const spendingTotalDelta = computeSpendingDelta(
    currentPeriod.spending.total,
    priorPeriod.spending.total
  )
  const incomeTotalDelta = computeSpendingDelta(
    currentPeriod.income.total,
    priorPeriod.income.total
  )

  const topCategoryChanges = buildCategoryBreakdownFromComparison(
    monthOverMonthComparison
  )
    .slice(0, 2)
    .map(({ category, currentTotal, priorTotal, spendingDelta }) => ({
      category,
      current: currentTotal,
      prior: priorTotal,
      delta: spendingDelta,
    }))

  const lines = [
    formatDeltaForPrompt(
      'Overall spending',
      currentPeriod.spending.total,
      priorPeriod.spending.total,
      spendingTotalDelta
    ),
    formatDeltaForPrompt(
      'Overall income',
      currentPeriod.income.total,
      priorPeriod.income.total,
      incomeTotalDelta,
      { metric: 'income' }
    ),
    ...topCategoryChanges.map(({ category, current, prior, delta }) =>
      formatDeltaForPrompt(category, current, prior, delta)
    ),
  ]

  const statDeltaExamples = [
    `Overall spending delta: ${JSON.stringify(
      toStatDelta(
        spendingTotalDelta,
        currentPeriod.spending.total,
        priorPeriod.spending.total
      )
    )}`,
    `Overall income delta: ${JSON.stringify(
      toStatDelta(incomeTotalDelta, currentPeriod.income.total, priorPeriod.income.total)
    )}`,
    ...topCategoryChanges.map(
      ({ category, current, prior, delta }) =>
        `${category} delta: ${JSON.stringify(toStatDelta(delta, current, prior))}`
    ),
  ]

  return {
    block: `

Pre-computed month-over-month spending and income changes (30-day windows — use these exact figures, do not recalculate).
These totals already exclude Self transfers between the user's own accounts and credit-card/loan payments.
Describe changes with calm dollar context (e.g. "$842 this period (was $700 before)"), not "1.2×" or "up 18%" headlines:
${lines.join('\n')}

When a stat corresponds to overall spending, overall income, or one of the spending categories above, include a "delta" object using the matching pre-computed values:
${statDeltaExamples.join('\n')}
For stats with no month-over-month match (e.g. liquid cash), set "delta": null.`,
    instruction: `

When month-over-month data is available, naturally reference the pre-computed figures in fullSummary where relevant (e.g. "dining is about $842 this period — was $700 in the prior 30 days"). Prefer dollars and plain language over times-multipliers or percentage headlines. Use only the exact figures provided above — do not invent or recalculate them from the transaction list. Do not say "last month" — the comparison is a rolling 30-day window, not a calendar month. For new spending categories, describe them as new rather than giving a multiplier.`,
  }
}

function normalizeInsightForPrompt(originalInsight) {
  if (typeof originalInsight === 'string') {
    try {
      return JSON.parse(originalInsight)
    } catch {
      return originalInsight
    }
  }
  return originalInsight
}

function formatInsightGeneratedAt(generatedAt) {
  if (!generatedAt) {
    return 'when this insight was generated'
  }

  const date = new Date(generatedAt)
  if (Number.isNaN(date.getTime())) {
    return String(generatedAt)
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function splitInsightForChatPrompt(insightForPrompt) {
  if (!insightForPrompt || typeof insightForPrompt !== 'object') {
    return {
      insightBody: insightForPrompt,
      monthOverMonthComparison: null,
      generatedAt: null,
    }
  }

  const {
    monthOverMonthComparison = null,
    metadata = null,
    ...insightBody
  } = insightForPrompt

  return {
    insightBody,
    monthOverMonthComparison,
    generatedAt: metadata?.generatedAt ?? null,
  }
}

/*
 * resolveInsightGeneratedAt(insightContent, fallbackCreatedAt)
 *
 * Prefers metadata.generatedAt from persisted insight JSON; falls back to the
 * DB row's created_at for legacy insights saved before metadata existed.
 */
export function resolveInsightGeneratedAt(insightContent, fallbackCreatedAt) {
  const insight = normalizeInsightForPrompt(insightContent)

  if (insight && typeof insight === 'object' && insight.metadata?.generatedAt) {
    return insight.metadata.generatedAt
  }

  return fallbackCreatedAt
}

/*
 * buildLiveFinancialChatPromptBlock(chatFinancialContext)
 *
 * Formats the live account, activity, and Expense Analyzer snapshot for chat.
 */
export function buildLiveFinancialChatPromptBlock(chatFinancialContext, { insightActions = [] } = {}) {
  if (!chatFinancialContext) {
    return { block: '', instruction: '' }
  }

  const capturedAtLabel = formatInsightGeneratedAt(chatFinancialContext.capturedAt)
  const {
    accounts,
    liveMonthOverMonth,
    recentActivity,
    expenseAnalyzer,
    dataScope,
    weeklyReview = null,
    monthCondition = null,
    openActions = [],
    userMemory = null,
  } = chatFinancialContext

  const mergedOpenActions = [
    ...insightActions.map((action) => ({
      description: action.description,
      completed: Boolean(action.completed),
      source: 'insight',
    })),
    ...(openActions ?? []).map((action) => ({
      description: action.description,
      status: action.status,
      source: action.source ?? 'weekly',
    })),
  ]

  return {
    block: `

Live financial snapshot (synced transaction data as of ${capturedAtLabel}):
${JSON.stringify(
  {
    dataScope,
    accounts,
    liveMonthOverMonth,
    recentActivity,
    expenseAnalyzer,
    weeklyReview,
    monthCondition,
    userMemory,
    openActions: mergedOpenActions,
    insightActions,
  },
  null,
  2
)}`,
    instruction: `

LIVE DATA RULES — use this block for spending, subscriptions, categories, accounts, and affordability:
- DEFAULT FRAME for general questions: start from weeklyReview (what's left until payday, runwayCoach, one risk, one move) and monthCondition.condition grade — not generic budgeting advice
- Prefer weeklyReview.whatsLeft / runwayCoach over raw balances for "can I afford X?" and "how am I doing this week?"
- Prefer monthCondition for "how is this month going?" / accountant-style condition questions
- userMemory compounds payday, problem categories, soft limits, spendingCap, goals, and prior actions — say "as we talked about…" when referencing them
- Prefer liveMonthOverMonth and expenseAnalyzer over the older insight snapshot for "right now" category/subscription questions
- expenseAnalyzer.categoryBreakdown has per-category MoM deltas — use for "which category went up/down most"
- expenseAnalyzer.topMover is the largest significant category change (≥5%)
- expenseAnalyzer.confirmedRecurring = high-confidence subscriptions in totals; cite monthlyEquivalent, annualEquivalent, confidenceLabel, sourceLabel
- expenseAnalyzer.reviewRecurring = uncertain patterns (Likely/Uncertain) — NOT in confirmed totals; explain why if asked
- weeklyReview.billDefense and expenseAnalyzer.billDefense flag price hikes, trials, duplicates — check these first for subscription/bill questions
- weeklyReview.whatsLeft.bills lists individual bills before payday — use them when explaining what's left
- userMemory.softLimits include isOver / isWarning / remaining / percentUsed — cite these for category-cap questions
- userMemory.spendingCap is the monthly spending tracker (safeToSpend) when configured
- dataScope.disconnectedAccountPolicy explains why old charges from disconnected banks disappear from recurring/category views
- If dataScope.disconnectedOrphanedTransactionCountLast90Days > 0, mention disconnected-account filtering when user asks why old merchants/subscriptions vanished
- accounts.items: credit cards (isCredit true) show balance owed; when present, spent + availableCredit are remaining credit; checking/savings show available cash; netTotalBalance nets them
- For discretionary purchases, prefer checking/savings cash — not netTotalBalance (which includes credit debt)
- recentActivity is connected accounts only — use for merchant-specific purchase questions
- openActions / insightActions are the user's to-dos — reference when they ask what to do next
- Name the time window when citing numbers: "this calendar week", "last 30 days", or the calendar month label — never conflate them
- Never say data is unavailable when this block contains it; only cite figures that appear here or in the insight snapshot

ANSWER SHAPE (paycheck-to-paycheck users — make advice usable today):
- For "can I afford $X?": cite whatsLeft.amount, billsUntilPaydayTotal, daysUntilPayday; give yes / no / caution with dollars remaining after the purchase. If a soft limit isOver/isWarning for that category, say so.
- For subscription/bill questions: check billDefense + confirmedRecurring first; when recommending cancel, cite monthly AND annual savings ($Y/mo, $Z/yr)
- For "walk me through my subscriptions / keep vs cancel" portfolio reviews: answer from expenseAnalyzer.confirmedRecurring (+ billDefense) only — do not call lookup tools unless a named merchant is missing from that list
- End actionable answers with ONE specific next step the user can do today (under 15 words), tied to an openAction when one exists, then a brief encouraging close when the topic was stressful, then (when the answer involved analysis or a recommendation) one specific engagement-hook question that offers a useful next layer — skip that question for simple factual lookups
- If weeklyReview.sparse is true or payday is not configured, say what setup unlocks better answers (set payday on Your week)
- Do not recommend payday loans, cash advances, or skipping rent/mortgage/utilities. Prefer concrete cuts from their recurring charges and open actions.
- Be direct but not shaming — tight budgets are often structural, not a moral failure. Pair hard news with capability ("here's exactly how"), not alarm.
- Tax, legal, investment, or insurance questions: share general knowledge, then one short line that this is not licensed advice`,
  }
}

export const COMMON_LIFE_QUESTIONS_PLAYBOOK = `
COMMON LIFE QUESTIONS — answer these fully; do not deflect or only say "check your dashboard":
You are also a practical money coach for everyday life. When the user asks how-to, planning, or general money questions, lead with a clear usable answer, then personalize with their live numbers when available.

1) HOW-TO / PROCESS (taxes online, open a bank account, dispute a charge, build credit, set up autopay):
- Give numbered steps a beginner can follow today (tools, order of operations, what to gather)
- Call out common pitfalls and "skip this if…" notes
- For US taxes online: walk through Free File / IRS Free File Fillable Forms vs paid software (TurboTax, H&R Block, Credit Karma Tax) based on complexity; list docs to gather (W-2, 1099s, last year's return); note deadlines and refunds vs payments; end with one short "not a tax preparer" line
- Never invent jurisdiction-specific legal requirements — if state/country matters and unknown, ask once, then give the default US federal path plus how to check their state

2) SPENDING PLANS (night out with friends, weekend trip, birthday gift, dinner date):
- First check weeklyReview.whatsLeft / bills until payday / soft limits / spendingCap
- Propose 2–3 budget tiers (lean / comfortable / stretch) with dollar caps grounded in what's left
- Break the plan into: total budget, per-person or per-activity split, what to cut if they overspend, and a clear ceiling amount
- If they can't afford it this week, say so plainly and offer a cheaper alternative or "wait until payday" option — never guilt-trip

3) MAXIMIZE SAVINGS / GET AHEAD:
- Use their data: confirmedRecurring (cancel/downgrade candidates with $/mo and $/yr), top categories and problemCategories, openActions, goals/spendingCap
- Give a ranked plan: (a) quick wins this week, (b) recurring cuts, (c) automation (pay-yourself-first on payday), (d) one habit change
- Quantify impact where possible ("canceling X frees ~$Y/mo")
- If savings goals exist in userMemory.goals, tie the plan to those targets

4) DEBT, BUDGETING METHODS, INVESTING BASICS (avalanche vs snowball, 50/30/20, emergency fund, Roth IRA basics):
- Explain the method clearly in plain English
- Then map it onto their situation with live numbers (balances, what's left, subscriptions)
- Keep investing/tax talk educational; one-line disclaimer that you're not a licensed advisor

5) CLARIFYING QUESTIONS:
- Ask at most ONE clarifying question only when a key fact is missing (city/state for taxes, group size for night out, target savings amount)
- Otherwise make a reasonable assumption, state it, and proceed with a complete answer`

/*
 * Shared conversation-style rules for both general and insight-scoped chat.
 * Voice first, accuracy always — keep the policy short so replies sound human.
 */
function buildChatConversationStyleBlock({ insightScoped = false } = {}) {
  const lengthRule = insightScoped
    ? 'Match length to the question: quick asks get 2–4 sentences; money decisions and how-tos get real steps or dollars and one next step'
    : 'Match length to the question — money decisions and how-tos always get usable steps or dollars and one next step'

  return `VOICE — talk like a calm, sharp friend who knows their numbers (not a dashboard bot or a policy manual):
- Use "I" naturally. Prefer short, spoken sentences over corporate phrasing.
- Lead with the answer or the one useful takeaway; numbers support the sentence — they are not the headline.
- If prior turns already covered something, reference it in one clause ("like we said about dining…") and do not re-explain.
- Skip stacked openings: do not always do acknowledge → analysis → encouragement → closing question. Pick what the moment needs.
- Mild opinions are fine when grounded in their data ("I'd cancel X first because it frees ~$Y/mo with the least pain").
- Prefer dollar context over scare multipliers: say "$525 this period (was $25 before)" not "21×" or "spending spike."
- Hard news: honest and direct, paired with one concrete next step — never shame, never panic theater.
- Match severity: light when things are fine; warm and direct when cash is tight. No false cheer.
- Warmth doesn't mean vagueness — every dollar, merchant, and category you cite must come from the live data.

CONVERSATION STYLE:
- Natural back-and-forth — if a key fact is missing mid-answer, ask at most one clarifying question; otherwise assume and proceed
- ${lengthRule}
- Everyday / how-to / planning questions: answer completely first, then connect to their live numbers when relevant — never brush them off with "I only answer about your transactions"
- Use markdown when it improves readability (bold key numbers, numbered steps, short lists)
- Comparisons (tools, plans, options): prefer a short bullet list — one option per line with the key tradeoff and price — over wide markdown tables. Tables are hard to read in a chat bubble; use them only when 3+ columns are truly needed
- Not a licensed advisor — brief disclaimer when the question needs licensed advice (tax, legal, investments, insurance); still share clear general knowledge

ENGAGEMENT HOOK — use a closing question only when it earns its place:
- Use it after analysis, a recommendation, or when a natural next layer exists (break down merchants, cancel vs keep, map a payoff).
- Skip it for yes/no afford answers, simple balance/fact questions, and when the user just wants a short plan they can act on.
- Never generic fillers ("What do you think?", "Does that help?"). One specific question tied to what you just said.
- Never repeat the same closing question twice in a row. At most one closing question — put any encouragement before it.
${buildChatToolsPromptHint()}
${COMMON_LIFE_QUESTIONS_PLAYBOOK}`
}

/*
 * buildExpenseAnalyzerChatPromptBlock(expenseAnalyzerContext)
 *
 * @deprecated Prefer buildLiveFinancialChatPromptBlock — kept for unit tests.
 */
export function buildExpenseAnalyzerChatPromptBlock(expenseAnalyzerContext) {
  if (!expenseAnalyzerContext) {
    return { block: '', instruction: '' }
  }

  return buildLiveFinancialChatPromptBlock({
    capturedAt: expenseAnalyzerContext.capturedAt,
    accounts: { netTotalBalance: 0, balanceNote: '', items: [] },
    liveMonthOverMonth: { hasData: false },
    recentActivity: null,
    expenseAnalyzer: expenseAnalyzerContext,
    dataScope: null,
  })
}

/*
 * buildInsightChatSystemPrompt({ insightBody, monthOverMonthComparison, generatedAt, chatFinancialContext })
 *
 * Insight snapshot (frozen) + live financial data for capable, trustworthy chat.
 */
export function buildInsightChatSystemPrompt({
  insightBody,
  monthOverMonthComparison,
  generatedAt,
  chatFinancialContext = null,
  expenseAnalyzerContext = null,
  insightActions = [],
  beforeYouSpendVerdict = null,
}) {
  const resolvedChatContext =
    chatFinancialContext ??
    (expenseAnalyzerContext
      ? {
          capturedAt: expenseAnalyzerContext.capturedAt,
          accounts: { netTotalBalance: 0, balanceNote: '', items: [] },
          liveMonthOverMonth: { hasData: false },
          recentActivity: null,
          expenseAnalyzer: expenseAnalyzerContext,
          dataScope: null,
        }
      : null)

  const momContext = buildMonthOverMonthPromptContext(monthOverMonthComparison)
  const liveContextBlock = buildLiveFinancialChatPromptBlock(resolvedChatContext, {
    insightActions,
  })
  const liveCapturedLabel = resolvedChatContext?.capturedAt
    ? formatInsightGeneratedAt(resolvedChatContext.capturedAt)
    : null

  const beforeYouSpendBlock = beforeYouSpendVerdict
    ? `

BEFORE YOU SPEND VERDICT (deterministic — lead with this for affordability questions):
${JSON.stringify(beforeYouSpendVerdict, null, 2)}

BEFORE YOU SPEND RULES:
- Lead your answer with this verdict (title + detail). Do not invent a conflicting yes/no.
- Explain whatsLeftAfter and any categoryLimit / reasons in plain English
- Then add one practical next step or cheaper alternative if the verdict is caution/risk`
    : ''

  /*
   * General chat (no insight yet): still ground answers in live synced data.
   * Why: users should be able to ask Soverm before generating their first insight.
   */
  if (insightBody == null) {
    return `You are Soverm — their personal money person for paycheck-to-paycheck life. Chat like a real advisor who already knows their accounts: warm, direct, specific. Not a report reader, not a chatbot script. They have not opened a weekly insight thread yet. Answer from live synced data below. Thorough when needed, brief when not.

DEFAULT JOB (unless they clearly ask something else):
- Ground answers in this week's remaining money (weeklyReview.whatsLeft / runwayCoach), the one risk + one move, openActions, and this month's condition grade (monthCondition).
- Prefer "what's left until payday" coaching over generic budgeting lectures.
- When userMemory has prior actions, soft limits, or payday facts, refer back ("as we talked about…").
- If they ask a how-to, planning, or general life-money question (taxes, night out, maximize savings, debt methods), follow the COMMON LIFE QUESTIONS playbook — answer fully, then personalize.

DATA SOURCES:
1. Live financial snapshot (below) — weekly review, month condition, user memory, balances, 30-day MoM, recent transactions, Expense Analyzer.
2. There is no weekly insight snapshot in this thread — do not invent one. If helpful, point them to Your week (/weekly-review) or the month letter for the structured ritual.

TRUST AND ACCURACY:
- Only cite dollar amounts, merchants, and categories that appear in the data below — never invent figures
- For recurring charges: cite merchant, monthly cost, annual cost, confidenceLabel (Confirmed/Likely/Uncertain), and sourceLabel
- Review-tier recurring (expenseAnalyzer.reviewRecurring) is uncertain — not counted in confirmed totals
- Credit card balances in accounts.items are debt owed (spent); use availableCredit when present for remaining limit; checking/savings are spendable cash
- If data is missing, say so plainly instead of guessing
- When giving opinions, ground them in their actual numbers

${buildChatConversationStyleBlock({ insightScoped: false })}
${beforeYouSpendBlock}

TIMING:
${liveCapturedLabel ? `- Live financial snapshot refreshed ${liveCapturedLabel}.` : '- Live financial snapshot timing is unknown.'}

${liveContextBlock.block}
${liveContextBlock.instruction}

Prior messages in this thread are in the messages array — maintain continuity and refer back when relevant. Do not restart from zero each turn.

FORMATTING:
- Conversational prose; dollar amounts written naturally ($1,072.80 not 1072.8)
- Short paragraphs; structure longer answers clearly
- Lead with plain language; numbers support the sentence
- Closing engagement-hook question only when it earns it (see ENGAGEMENT HOOK) — never force a CTA after a simple fact or clear yes/no
- For ranked plans (night out budgets, savings steps, tax how-tos with 2+ steps), after your markdown answer append a fenced block:
\`\`\`soverm-plan
{"title":"short plan title","summary":"one line","cards":[{"title":"...","detail":"...","tone":"fine|warning|danger|neutral","amount":"$40","label":"lean"}]}
\`\`\`
  Use tone/amount/label when useful. Do not put the fence in the middle of prose.`
  }

  const generatedAtLabel = formatInsightGeneratedAt(generatedAt)
  const snapshotCapturedAt = monthOverMonthComparison?.capturedAt
    ? formatInsightGeneratedAt(monthOverMonthComparison.capturedAt)
    : null

  const snapshotTimingNote = snapshotCapturedAt
    ? `Insight snapshot month-over-month figures were captured on ${snapshotCapturedAt}.`
    : 'Insight snapshot month-over-month figures come from when the insight was generated.'

  return `You are Soverm — their personal money person for paycheck-to-paycheck life. Chat like a real advisor who already knows their accounts: warm, direct, specific. Not a report reader, not a chatbot script. You have their live synced data and this week's insight snapshot. Thorough when needed, brief when not.

DEFAULT JOB (unless they clearly ask something else):
- Ground answers in this week's remaining money (weeklyReview.whatsLeft / runwayCoach), the one risk + one move, openActions, and this month's condition grade (monthCondition).
- Prefer "what's left until payday" coaching over generic budgeting lectures.
- When userMemory has prior actions, soft limits, or payday facts, refer back ("as we talked about…").
- If they ask a how-to, planning, or general life-money question (taxes, night out, maximize savings, debt methods), follow the COMMON LIFE QUESTIONS playbook — answer fully, then personalize.

DATA SOURCES — pick the right one for each question:
1. Live financial snapshot (below) — weekly review, month condition, user memory, balances, live 30-day MoM, recent transactions, Expense Analyzer. Use this for "what's happening now", subscriptions, categories, recent purchases, and affordability questions.
2. Insight snapshot (below) — the weekly insight Soverm generated on ${generatedAtLabel}. Use for what was flagged then; prefer live data when the user asks about current state.
3. Insight snapshot month-over-month block — frozen figures from insight generation. Prefer liveMonthOverMonth in the live snapshot for current comparisons.

TRUST AND ACCURACY:
- Only cite dollar amounts, merchants, and categories that appear in the data below — never invent figures
- When live data and the insight snapshot differ, prefer live data and note the insight is from ${generatedAtLabel}
- For recurring charges: cite merchant, monthly cost, annual cost, confidenceLabel (Confirmed/Likely/Uncertain), and sourceLabel
- Review-tier recurring (expenseAnalyzer.reviewRecurring) is uncertain — not counted in confirmed totals; explain detectionReason if asked why something is under review
- Disconnected bank accounts: charges from disconnected accounts are excluded from recurring and category views — explain using dataScope.disconnectedAccountPolicy when user asks why old subscriptions/rides vanished
- Credit card balances in accounts.items are debt owed (spent); use availableCredit when present for remaining limit; checking/savings are spendable cash — netTotalBalance nets them for overall liquidity
- If data is missing (e.g. no income synced), say so plainly instead of guessing
- When giving opinions ("is this too high?"), ground them in their actual numbers and explain your reasoning

${buildChatConversationStyleBlock({ insightScoped: true })}
${beforeYouSpendBlock}

TIMING:
- Insight snapshot reflects finances as of ${generatedAtLabel}. ${snapshotTimingNote}
${liveCapturedLabel ? `- Live financial snapshot refreshed ${liveCapturedLabel}.` : ''}

Their insight snapshot (generated ${generatedAtLabel}):
${JSON.stringify(insightBody)}
${momContext.block}
${liveContextBlock.block}

${snapshotTimingNote}${momContext.instruction}${liveContextBlock.instruction}

Prior messages in this thread are in the messages array — maintain continuity and refer back when relevant. Do not restart from zero each turn.

FORMATTING:
- Conversational prose; dollar amounts written naturally ($1,072.80 not 1072.8)
- Short paragraphs; structure longer answers clearly
- Lead with plain language; numbers support the sentence
- Closing engagement-hook question only when it earns it (see ENGAGEMENT HOOK) — never force a CTA after a simple fact or clear yes/no
- For ranked plans (night out budgets, savings steps, tax how-tos with 2+ steps), after your markdown answer append a fenced block:
\`\`\`soverm-plan
{"title":"short plan title","summary":"one line","cards":[{"title":"...","detail":"...","tone":"fine|warning|danger|neutral","amount":"$40","label":"lean"}]}
\`\`\`
  Use tone/amount/label when useful. Do not put the fence in the middle of prose.`
}

export const CHAT_HISTORY_MESSAGE_LIMIT = 30
export const CHAT_MAX_OUTPUT_TOKENS = 2048

/*
 * What this does: detects "review all my subscriptions" questions that the
 * Expense Analyzer snapshot already answers.
 * Why: tool rounds (one lookup per merchant) make Review subscriptions hang
 * for 30–90s with no tokens. confirmedRecurring already has the list.
 */
export function shouldSkipLookupToolsForQuestion(question, chatFinancialContext) {
  const text = String(question || '').toLowerCase()
  const recurringCount =
    chatFinancialContext?.expenseAnalyzer?.confirmedRecurring?.length ??
    chatFinancialContext?.expenseAnalyzer?.totals?.confirmedCount ??
    0

  if (recurringCount < 1) {
    return false
  }

  const isPortfolioReview =
    /walk me through my subscriptions/.test(text) ||
    /worth keeping vs cancel/.test(text) ||
    /review (all |my )?subscriptions/.test(text)

  return isPortfolioReview
}

async function streamClaudeTextReply({
  systemPrompt,
  messages,
  onDelta,
  emitStatus,
}) {
  emitStatus?.({
    phase: 'writing',
    title: 'Generating…',
    detail: null,
  })

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: CHAT_MAX_OUTPUT_TOKENS,
    temperature: 0.6,
    system: systemPrompt,
    messages,
  })

  let fullText = ''
  stream.on('text', (_delta, snapshot) => {
    fullText = snapshot
    onDelta?.(snapshot, snapshot)
  })
  await stream.finalMessage()
  return fullText
}

function extractAssistantText(contentBlocks = []) {
  return contentBlocks
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function collectToolUses(contentBlocks = []) {
  return contentBlocks.filter((block) => block.type === 'tool_use')
}

async function buildToolResultBlocks(userId, toolUses) {
  const results = []

  for (const toolUse of toolUses) {
    let payload
    try {
      payload = await executeChatLookupTool(userId, toolUse.name, toolUse.input || {})
    } catch (err) {
      payload = { error: err.message || 'Lookup failed' }
    }

    results.push({
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: JSON.stringify(payload),
    })
  }

  return results
}

/*
 * Agentic chat loop: Claude may call get_category_transactions /
 * get_merchant_history, we run the lookups, then continue until a text answer.
 */
async function runChatWithOptionalTools({
  systemPrompt,
  messages,
  userId = null,
  onDelta = null,
}) {
  let workingMessages = [...messages]
  const toolsEnabled = Boolean(userId)

  for (let round = 0; round < CHAT_MAX_TOOL_ROUNDS; round += 1) {
    const allowTools = toolsEnabled && round < CHAT_MAX_TOOL_ROUNDS
    const request = {
      model: 'claude-sonnet-4-6',
      max_tokens: CHAT_MAX_OUTPUT_TOKENS,
      temperature: 0.6,
      system: systemPrompt,
      messages: workingMessages,
      ...(allowTools ? { tools: CHAT_LOOKUP_TOOLS } : {}),
    }

    const response = await anthropic.messages.create(request)
    const toolUses = collectToolUses(response.content)

    if (toolUses.length === 0 || !allowTools) {
      const text = extractAssistantText(response.content)
      if (onDelta && text) {
        onDelta(text, text)
      }
      return text
    }

    workingMessages = [
      ...workingMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: await buildToolResultBlocks(userId, toolUses) },
    ]
  }

  const finalStreamOrCreate = onDelta
    ? anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: CHAT_MAX_OUTPUT_TOKENS,
        temperature: 0.6,
        system: systemPrompt,
        messages: workingMessages,
      })
    : null

  if (finalStreamOrCreate) {
    let fullText = ''
    finalStreamOrCreate.on('text', (_delta, snapshot) => {
      fullText = snapshot
      onDelta?.(snapshot, snapshot)
    })
    await finalStreamOrCreate.finalMessage()
    return fullText
  }

  const finalResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: CHAT_MAX_OUTPUT_TOKENS,
    temperature: 0.6,
    system: systemPrompt,
    messages: workingMessages,
  })

  return extractAssistantText(finalResponse.content)
}

/*
 * askFinancialQuestion(originalInsight, chatHistory, newQuestion, options)
 *
 * Conversational follow-up — plain text, grounded in live financial data + insight snapshot.
 * May call lookup tools when userId is provided.
 */
export async function askFinancialQuestion(
  originalInsight,
  chatHistory,
  newQuestion,
  options = {}
) {
  const {
    generatedAt,
    chatFinancialContext = null,
    expenseAnalyzerContext = null,
    insightActions = [],
    beforeYouSpendVerdict = null,
    userId = null,
  } = options

  const { systemPrompt, messages } = buildChatCompletionPayload(
    originalInsight,
    chatHistory,
    newQuestion,
    {
      generatedAt,
      chatFinancialContext,
      expenseAnalyzerContext,
      insightActions,
      beforeYouSpendVerdict,
    }
  )

  try {
    const skipTools =
      !userId ||
      shouldSkipLookupToolsForQuestion(newQuestion, chatFinancialContext)

    return await runChatWithOptionalTools({
      systemPrompt,
      messages,
      userId: skipTools ? null : userId,
    })
  } catch (err) {
    console.error('Failed to answer financial question:', err.message)
    throw new Error(`Claude chat response failed: ${err.message}`)
  }
}

/*
 * What this does: streams Claude tokens for Ask Soverm.
 * Why: long answers feel fast on mobile when text appears as it generates.
 * How: tool rounds run first (if needed); onStatus keeps the UI honest during
 * lookups; then text is emitted via onDelta.
 */
export async function askFinancialQuestionStream(
  originalInsight,
  chatHistory,
  newQuestion,
  options = {},
  { onDelta, onStatus } = {}
) {
  const {
    generatedAt,
    chatFinancialContext = null,
    expenseAnalyzerContext = null,
    insightActions = [],
    beforeYouSpendVerdict = null,
    userId = null,
  } = options

  const { systemPrompt, messages } = buildChatCompletionPayload(
    originalInsight,
    chatHistory,
    newQuestion,
    {
      generatedAt,
      chatFinancialContext,
      expenseAnalyzerContext,
      insightActions,
      beforeYouSpendVerdict,
    }
  )

  const emitStatus = (status) => {
    if (status && typeof onStatus === 'function') {
      onStatus(status)
    }
  }

  try {
    emitStatus({
      phase: 'thinking',
      title: 'Thinking…',
      detail: null,
    })

    const skipTools =
      !userId ||
      shouldSkipLookupToolsForQuestion(newQuestion, chatFinancialContext)

    /*
     * When tools may run, complete tool rounds with create(), then stream only
     * the final text turn so the UI still gets progressive tokens when possible.
     * Subscription portfolio reviews skip tools — confirmedRecurring is enough
     * and per-merchant lookups made "Review subscriptions" hang with no words.
     */
    if (skipTools) {
      return await streamClaudeTextReply({
        systemPrompt,
        messages,
        onDelta,
        emitStatus,
      })
    }

    let workingMessages = [...messages]

    for (let round = 0; round < CHAT_MAX_TOOL_ROUNDS; round += 1) {
      emitStatus({
        phase: 'thinking',
        title: round === 0 ? 'Thinking…' : 'Thinking…',
        detail: round === 0 ? null : 'Putting the pieces together',
      })

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: CHAT_MAX_OUTPUT_TOKENS,
        temperature: 0.6,
        system: systemPrompt,
        messages: workingMessages,
        tools: CHAT_LOOKUP_TOOLS,
      })

      const toolUses = collectToolUses(response.content)
      if (toolUses.length === 0) {
        const text = extractAssistantText(response.content)
        if (text) {
          emitStatus({
            phase: 'writing',
            title: 'Generating…',
            detail: null,
          })
          onDelta?.(text, text)
        }
        return text
      }

      emitStatus(formatChatLookupStatus(toolUses))
      workingMessages = [
        ...workingMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: await buildToolResultBlocks(userId, toolUses) },
      ]
    }

    return await streamClaudeTextReply({
      systemPrompt,
      messages: workingMessages,
      onDelta,
      emitStatus,
    })
  } catch (err) {
    console.error('Failed to stream financial question:', err.message)
    throw new Error(`Claude chat response failed: ${err.message}`)
  }
}

function buildChatCompletionPayload(
  originalInsight,
  chatHistory,
  newQuestion,
  {
    generatedAt,
    chatFinancialContext = null,
    expenseAnalyzerContext = null,
    insightActions = [],
    beforeYouSpendVerdict = null,
  } = {}
) {
  const historyMessages = chatHistory.map(({ role, content }) => ({ role, content }))

  let insightBody = null
  let monthOverMonthComparison = null
  let metadataGeneratedAt = null

  if (originalInsight != null) {
    const insightForPrompt = normalizeInsightForPrompt(originalInsight)
    ;({ insightBody, monthOverMonthComparison, generatedAt: metadataGeneratedAt } =
      splitInsightForChatPrompt(insightForPrompt))
  }

  const systemPrompt = buildInsightChatSystemPrompt({
    insightBody,
    monthOverMonthComparison,
    generatedAt: generatedAt ?? metadataGeneratedAt,
    chatFinancialContext,
    expenseAnalyzerContext,
    insightActions,
    beforeYouSpendVerdict,
  })

  return {
    systemPrompt,
    messages: [...historyMessages, { role: 'user', content: newQuestion }],
  }
}

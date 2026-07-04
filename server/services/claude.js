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
} from '../utils/financialContext.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Soverm, a personal AI CFO. You analyze financial data and respond ONLY with valid JSON, nothing else — no markdown code blocks, no explanation text before or after, just the raw JSON object. You are honest and direct, never sugar-coating bad financial decisions, but always constructive.`

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
  "headline": "One punchy sentence (max 15 words) capturing the single most important thing about this person's finances right now — can be a warning, a win, or a key fact",
  "headlineType": "warning" or "positive" or "neutral",
  "stats": [
    {
      "label": "short 2-3 word label",
      "value": "the key number, formatted with $ if money",
      "detail": "one short sentence of context, max 12 words",
      "statType": "spending" or "income" or "neutral",
      "delta": {
        "direction": "up" or "down" or "flat" or null,
        "percent": 18,
        "vsLabel": "vs prior 30 days"
      }
    },
    (exactly 3 stat objects total, covering: biggest expense, a debt/risk metric if relevant OR income highlight, and liquid cash position)
  ],
  "fullSummary": [
    "Paragraph 1 (40-60 words): The Situation — describe their current financial position in context, what the numbers add up to right now",
    "Paragraph 2 (40-60 words): The Risk or Pattern — the single most important risk, habit, or pattern they should be aware of",
    "Paragraph 3 (30-50 words): The Move — one clear, specific, actionable recommendation to address it"
  ],
  "actions": [
    "specific action with a number if possible, max 15 words",
    "specific action with a number if possible, max 15 words",
    "specific action with a number if possible, max 15 words"
  ]
}

Each stat object must include "statType" and a "delta" field. Set statType to "income" for income/paycheck/deposit stats, "neutral" for cash balances, debt ratios, or other non-spend metrics, and "spending" for expense categories and overall spending. Use the pre-computed delta values provided above when the stat matches overall spending or a listed category; otherwise set "delta": null. Do not calculate percentages yourself.

fullSummary must be an array of exactly 3 strings. Each string is a complete standalone paragraph. Do not use line breaks within a single string — each paragraph is its own array element.${monthOverMonthInstruction}${expenseAnalyzerInstruction}

actions must be an array of exactly 3 strings. Each one is a specific, concrete next step the person can take this week. Use real numbers from their data when relevant. Order from most urgent/impactful to least.`,
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
    .map(
      (t) =>
        `${t.date} | ${t.name} | $${t.amount} | ${t.category || 'Uncategorized'}`
    )
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
    const { direction, percent } = overallSpending.delta
    lines.push(
      `Overall spending: ${direction} ${percent ?? 0}% vs prior 30 days ($${overallSpending.currentTotal} vs $${overallSpending.priorTotal})`
    )
  }

  if (topMover?.percent != null && topMover.direction !== 'flat' && topMover.percent >= 5) {
    lines.push(
      `Top category mover: ${topMover.category} ${topMover.direction} ${topMover.percent}% vs prior 30 days`
    )
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
    delta: toStatDelta(spendingTotalDelta),
  })

  const incomeTotalDelta = computeSpendingDelta(
    currentPeriod.income.total,
    priorPeriod.income.total
  )
  entries.push({
    kind: 'income',
    label: 'Overall income',
    matchTerms: OVERALL_INCOME_MATCH_TERMS,
    delta: toStatDelta(incomeTotalDelta),
  })

  for (const { category, spendingDelta } of buildCategoryBreakdownFromComparison(
    monthOverMonthComparison
  )) {
    entries.push({
      kind: 'category',
      label: category,
      matchTerms: [category, ...tokenizeMatchText(category)],
      delta: toStatDelta(spendingDelta),
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

function toStatDelta(delta) {
  if (!delta) {
    return null
  }

  if (delta.isNewCategory) {
    return {
      direction: 'up',
      percent: null,
      vsLabel: MONTH_OVER_MONTH_VS_LABEL,
    }
  }

  return {
    direction: delta.direction,
    percent: delta.percent,
    vsLabel: MONTH_OVER_MONTH_VS_LABEL,
  }
}

function formatDeltaForPrompt(category, current, prior, delta, { metric = 'spending' } = {}) {
  if (delta.isNewCategory) {
    if (metric === 'income') {
      return `- ${category}: new income this period ($${current} this period, $0 in the prior period)`
    }

    return `- ${category}: new spending category ($${current} this period, $0 in the prior period)`
  }

  if (delta.direction === 'flat') {
    return `- ${category}: flat (0%) ${MONTH_OVER_MONTH_VS_LABEL} ($${current} vs $${prior})`
  }

  return `- ${category}: ${delta.direction} ${delta.percent}% ${MONTH_OVER_MONTH_VS_LABEL} ($${current} vs $${prior})`
}

function buildMonthOverMonthPromptContext(monthOverMonthComparison) {
  if (!monthOverMonthComparison?.hasComparisonData) {
    return {
      block: `

No month-over-month comparison is available for this user. Do not reference any month-over-month or prior-period comparison in the headline, stats, or fullSummary. Set "delta": null on every stat object.`,
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
    `Overall spending delta: ${JSON.stringify(toStatDelta(spendingTotalDelta))}`,
    `Overall income delta: ${JSON.stringify(toStatDelta(incomeTotalDelta))}`,
    ...topCategoryChanges.map(
      ({ category, delta }) =>
        `${category} delta: ${JSON.stringify(toStatDelta(delta))}`
    ),
  ]

  return {
    block: `

Pre-computed month-over-month spending and income changes (30-day windows — use these exact figures, do not recalculate):
${lines.join('\n')}

When a stat corresponds to overall spending, overall income, or one of the spending categories above, include a "delta" object using the matching pre-computed values:
${statDeltaExamples.join('\n')}
For stats with no month-over-month match (e.g. liquid cash), set "delta": null.`,
    instruction: `

When month-over-month data is available, naturally reference the pre-computed figures in fullSummary where relevant (e.g. "dining spend jumped 18% vs the prior 30 days"). Use only the exact percentages and directions provided above — do not invent or recalculate them. Do not say "last month" — the comparison is a rolling 30-day window, not a calendar month. For new spending categories, describe them as new rather than giving a percentage.`,
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
 * buildInsightChatSystemPrompt({ insightBody, monthOverMonthComparison, generatedAt })
 *
 * Assembles the frozen snapshot context for insight-scoped chat.
 * Exported for unit tests — chat must not pull live transaction data.
 */
export function buildInsightChatSystemPrompt({
  insightBody,
  monthOverMonthComparison,
  generatedAt,
}) {
  const generatedAtLabel = formatInsightGeneratedAt(generatedAt)
  const momContext = buildMonthOverMonthPromptContext(monthOverMonthComparison)
  const snapshotCapturedAt = monthOverMonthComparison?.capturedAt
    ? formatInsightGeneratedAt(monthOverMonthComparison.capturedAt)
    : null

  const snapshotTimingNote = snapshotCapturedAt
    ? `The month-over-month figures below were captured on ${snapshotCapturedAt}.`
    : 'Month-over-month figures come from the stored insight snapshot.'

  return `You are Soverm, a personal AI CFO. You are having an ongoing conversation with a user about a specific financial insight you generated on ${generatedAtLabel}.

You have two modes — use whichever fits the question:

1. DATA-SPECIFIC: If the question is about their personal finances as reflected in this insight, use only the numbers from the insight snapshot below. Be specific, direct, and honest. Never vague.

2. GENERAL FINANCIAL KNOWLEDGE: If the question is a general finance question (e.g. "how do I open a savings account", "what's a Roth IRA", "should I pay off debt or invest", "what's compound interest"), answer it clearly and helpfully like a knowledgeable advisor would. Use plain English, no jargon. Keep it practical and actionable.

In both cases:
- Keep answers conversational and concise — 2-4 sentences for most questions, longer only if genuinely needed
- Never refuse a reasonable financial question
- Always be honest — don't sugarcoat bad financial habits
- End general advice answers with one sentence connecting it back to their insight snapshot if relevant (e.g. "Given the $X liquid cash shown in your insight from ${generatedAtLabel}, a HYSA would make sense as your next step.")
- You are not a licensed financial advisor — if someone asks about something requiring licensed advice (specific tax filing, legal contracts, investment management), briefly note that and suggest they consult a professional, then still give them the general knowledge you can
- Do not imply the figures below reflect their finances today. If timing matters, say they are from when you generated this insight (${generatedAtLabel}). You do not have access to live bank data in this conversation.

Their insight snapshot (generated ${generatedAtLabel}):
${JSON.stringify(insightBody)}
${momContext.block}

${snapshotTimingNote}${momContext.instruction}

Chat history is provided in the messages array.

FORMATTING RULES:
- Write conversationally, like a knowledgeable friend
- Use markdown naturally when it aids clarity: bold for key terms, numbered lists for steps, bullet points for options
- Keep responses concise — 2-4 sentences for simple questions, structured lists only when genuinely helpful
- Short paragraphs, not walls of text
- Never start a response with "I" — lead with the substance
- Numbers and dollar amounts written naturally ($5,020 not 5020)`
}

/*
 * askFinancialQuestion(originalInsight, chatHistory, newQuestion, { generatedAt })
 *
 * Conversational follow-up about a specific insight — returns plain text, not JSON.
 * Uses the persisted insight snapshot (including monthOverMonthComparison), not live data.
 */
export async function askFinancialQuestion(
  originalInsight,
  chatHistory,
  newQuestion,
  { generatedAt } = {}
) {
  const insightForPrompt = normalizeInsightForPrompt(originalInsight)
  const { insightBody, monthOverMonthComparison, generatedAt: metadataGeneratedAt } =
    splitInsightForChatPrompt(insightForPrompt)
  const historyMessages = chatHistory.map(({ role, content }) => ({ role, content }))

  const systemPrompt = buildInsightChatSystemPrompt({
    insightBody,
    monthOverMonthComparison,
    generatedAt: generatedAt ?? metadataGeneratedAt,
  })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...historyMessages,
        { role: 'user', content: newQuestion },
      ],
    })

    return response.content[0].text
  } catch (err) {
    console.error('Failed to answer financial question:', err.message)
    throw new Error(`Claude chat response failed: ${err.message}`)
  }
}

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
import { buildExpenseAnalyzerChatContextFromPayload } from '../utils/expenseAnalyzerChatContext.js'

export { buildExpenseAnalyzerChatContextFromPayload }

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
- accounts.items: credit cards (isCredit true) show balance owed; checking/savings show available cash; netTotalBalance nets them
- For discretionary purchases, prefer checking/savings cash — not netTotalBalance (which includes credit debt)
- recentActivity is connected accounts only — use for merchant-specific purchase questions
- openActions / insightActions are the user's to-dos — reference when they ask what to do next
- Name the time window when citing numbers: "this calendar week", "last 30 days", or the calendar month label — never conflate them
- Never say data is unavailable when this block contains it; only cite figures that appear here or in the insight snapshot

ANSWER SHAPE (paycheck-to-paycheck users — make advice usable today):
- For "can I afford $X?": cite whatsLeft.amount, billsUntilPaydayTotal, daysUntilPayday; give yes / no / caution with dollars remaining after the purchase. If a soft limit isOver/isWarning for that category, say so.
- For subscription/bill questions: check billDefense + confirmedRecurring first; when recommending cancel, cite monthly AND annual savings ($Y/mo, $Z/yr)
- End actionable answers with ONE specific next step the user can do today (under 15 words), tied to an openAction when one exists
- If weeklyReview.sparse is true or payday is not configured, say what setup unlocks better answers (set payday on Your week)
- Do not recommend payday loans, cash advances, or skipping rent/mortgage/utilities. Prefer concrete cuts from their recurring charges and open actions.
- Be direct but not shaming — tight budgets are often structural, not a moral failure
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
- Break the plan into: total budget, per-person or per-activity split, what to cut if they overspend, and a hard stop amount
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
 */
function buildChatConversationStyleBlock({ insightScoped = false } = {}) {
  const lengthRule = insightScoped
    ? 'Match answer length to the question: quick questions get 2-4 sentences; complex ones can use paragraphs, bullets, or numbered steps — but for money decisions (afford, cancel, cut) and common life questions (taxes, night out, savings), always include usable steps or dollars and one next step'
    : 'Match answer length to the question — but for money decisions (afford, cancel, cut) and common life questions (taxes, night out, savings), always include usable steps or dollars and one next step'

  return `CONVERSATION STYLE:
- Natural back-and-forth — ask a clarifying question when it would genuinely help
- ${lengthRule}
- Everyday / how-to / planning questions: answer completely first, then connect to their live numbers when relevant — never brush them off with "I only answer about your transactions"
- Use markdown when it improves readability (bold key numbers, numbered steps, short lists)
- Be honest but constructive — never shame
- Not a licensed advisor — brief disclaimer when the question needs licensed advice (tax, legal, investments, insurance); still share clear general knowledge
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
    return `You are Soverm, a personal AI CFO for paycheck-to-paycheck users — a knowledgeable, direct financial assistant in an ongoing chat. They have not opened a weekly insight thread yet. Answer using their live synced financial data below. Answer like a capable advisor: thorough when the question needs depth, concise when it doesn't.

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
- Credit card balances in accounts.items are debt owed; checking/savings are spendable cash
- If data is missing, say so plainly instead of guessing
- When giving opinions, ground them in their actual numbers

${buildChatConversationStyleBlock({ insightScoped: false })}
${beforeYouSpendBlock}

TIMING:
${liveCapturedLabel ? `- Live financial snapshot refreshed ${liveCapturedLabel}.` : '- Live financial snapshot timing is unknown.'}

${liveContextBlock.block}
${liveContextBlock.instruction}

Prior messages in this thread are in the messages array — maintain continuity and refer back when relevant.

FORMATTING:
- Write conversationally, like a knowledgeable friend who knows their numbers
- Dollar amounts written naturally ($1,072.80 not 1072.8 in prose)
- Short paragraphs beat walls of text; structure longer answers clearly
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

  return `You are Soverm, a personal AI CFO for paycheck-to-paycheck users — a knowledgeable, direct financial assistant in an ongoing chat with this user. You have access to their real synced financial data below. Answer like a capable advisor: thorough when the question needs depth, concise when it doesn't. This should feel like talking to a smart financial assistant, not reading a report.

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
- Credit card balances in accounts.items are debt owed; checking/savings are spendable cash — netTotalBalance nets them for overall liquidity
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

Prior messages in this thread are in the messages array — maintain continuity and refer back when relevant.

FORMATTING:
- Write conversationally, like a knowledgeable friend who knows their numbers
- Dollar amounts written naturally ($1,072.80 not 1072.8 in prose)
- Short paragraphs beat walls of text; structure longer answers clearly
- For ranked plans (night out budgets, savings steps, tax how-tos with 2+ steps), after your markdown answer append a fenced block:
\`\`\`soverm-plan
{"title":"short plan title","summary":"one line","cards":[{"title":"...","detail":"...","tone":"fine|warning|danger|neutral","amount":"$40","label":"lean"}]}
\`\`\`
  Use tone/amount/label when useful. Do not put the fence in the middle of prose.`
}

export const CHAT_HISTORY_MESSAGE_LIMIT = 30
export const CHAT_MAX_OUTPUT_TOKENS = 2048

/*
 * askFinancialQuestion(originalInsight, chatHistory, newQuestion, options)
 *
 * Conversational follow-up — plain text, grounded in live financial data + insight snapshot.
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
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: CHAT_MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      system: systemPrompt,
      messages,
    })

    return response.content[0].text
  } catch (err) {
    console.error('Failed to answer financial question:', err.message)
    throw new Error(`Claude chat response failed: ${err.message}`)
  }
}

/*
 * What this does: streams Claude tokens for Ask Soverm.
 * Why: long answers feel fast on mobile when text appears as it generates.
 * How: yields text deltas via onDelta; returns the full reply when done.
 */
export async function askFinancialQuestionStream(
  originalInsight,
  chatHistory,
  newQuestion,
  options = {},
  { onDelta } = {}
) {
  const {
    generatedAt,
    chatFinancialContext = null,
    expenseAnalyzerContext = null,
    insightActions = [],
    beforeYouSpendVerdict = null,
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
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: CHAT_MAX_OUTPUT_TOKENS,
      temperature: 0.4,
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

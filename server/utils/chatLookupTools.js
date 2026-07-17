/*
 * CHAT LOOKUP TOOLS
 *
 * What this does:
 * - Defines Anthropic tool schemas so Ask Soverm can fetch live transactions
 *   mid-conversation (by category or merchant)
 * - Runs the DB lookups scoped to the signed-in user
 *
 * Why:
 * - The live snapshot is a summary. Without tools, Claude cannot dig into
 *   "which Chipotle charges?" or "show Food and Drink this month."
 *
 * Bigger picture:
 * - askFinancialQuestion / stream call runChatToolRounds, which may invoke
 *   these tools a few times, then return a normal text answer.
 */

import db from '../db/index.js'
import {
  CONNECTED_ACCOUNT_TRANSACTION_JOINS,
  EXPENSE_ANALYZER_TRANSACTION_SELECT,
} from './connectedAccountTransactions.js'
import { isCashFlowSpendingRow } from './cashFlowClassification.js'
import { resolveSpendingCategoryLabel } from './plaidCategory.js'
import { normalizeMerchantName } from './merchantNormalize.js'
import { NON_PENDING_FILTER } from './transactionFilters.js'
import { getAppTodayIso } from './calendarMonth.js'
import { roundCurrency } from './safeToSpend.js'

export const CHAT_LOOKUP_TOOLS = [
  {
    name: 'get_category_transactions',
    description:
      'Look up recent external spending transactions in a category (e.g. Food and Drink, Shopping). Use when the user asks what drove a category, wants examples, or the snapshot is not detailed enough.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category label as the user sees it (e.g. "Food and Drink").',
        },
        days: {
          type: 'number',
          description: 'How many days back to search (default 30, max 90).',
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return (default 12, max 25).',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_merchant_history',
    description:
      'Look up recent transactions for a merchant or payee name (e.g. Chipotle, Spotify, Venmo). Use when the user asks about a specific store, subscription, or person.',
    input_schema: {
      type: 'object',
      properties: {
        merchant: {
          type: 'string',
          description: 'Merchant or payee name to search for.',
        },
        days: {
          type: 'number',
          description: 'How many days back to search (default 60, max 120).',
        },
        limit: {
          type: 'number',
          description: 'Max transactions to return (default 12, max 25).',
        },
      },
      required: ['merchant'],
    },
  },
]

const MAX_LOOKBACK_CATEGORY = 90
const MAX_LOOKBACK_MERCHANT = 120
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 25

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.round(n)))
}

function toIsoDate(dateInput) {
  if (typeof dateInput === 'string') {
    return dateInput.slice(0, 10)
  }
  return String(dateInput).slice(0, 10)
}

function mapPublicTransaction(row) {
  return {
    date: toIsoDate(row.date),
    name: row.name,
    amount: roundCurrency(Math.abs(Number(row.amount) || 0)),
    category: resolveSpendingCategoryLabel(row),
    account: row.account_name || null,
  }
}

async function loadRecentSpendingRows(userId, days) {
  const todayIso = getAppTodayIso()
  const result = await db.query(
    `SELECT ${EXPENSE_ANALYZER_TRANSACTION_SELECT}
     FROM transactions t
     ${CONNECTED_ACCOUNT_TRANSACTION_JOINS}
     WHERE t.user_id = $1
       ${NON_PENDING_FILTER}
       AND t.date >= ($2::date - ($3::int * INTERVAL '1 day'))
       AND t.date <= $2::date
     ORDER BY t.date DESC
     LIMIT 500`,
    [userId, todayIso, days]
  )

  return result.rows.filter((row) => isCashFlowSpendingRow(row))
}

export async function getCategoryTransactions(userId, { category, days, limit } = {}) {
  const lookback = clampInt(days, 30, 1, MAX_LOOKBACK_CATEGORY)
  const rowLimit = clampInt(limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const needle = String(category || '')
    .trim()
    .toLowerCase()

  if (!needle) {
    return { error: 'category is required', transactions: [], total: 0 }
  }

  const rows = await loadRecentSpendingRows(userId, lookback)
  const matched = rows.filter((row) => {
    const label = resolveSpendingCategoryLabel(row).toLowerCase()
    return label === needle || label.includes(needle) || needle.includes(label)
  })

  const sliced = matched.slice(0, rowLimit).map(mapPublicTransaction)
  const total = roundCurrency(
    matched.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0)
  )

  return {
    category: category.trim(),
    days: lookback,
    matchCount: matched.length,
    total,
    transactions: sliced,
  }
}

export async function getMerchantHistory(userId, { merchant, days, limit } = {}) {
  const lookback = clampInt(days, 60, 1, MAX_LOOKBACK_MERCHANT)
  const rowLimit = clampInt(limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const raw = String(merchant || '').trim()
  if (!raw) {
    return { error: 'merchant is required', transactions: [], total: 0 }
  }

  const needleKey = normalizeMerchantName(raw)
  const needleLower = raw.toLowerCase()
  const rows = await loadRecentSpendingRows(userId, lookback)

  const matched = rows.filter((row) => {
    const name = String(row.name || '')
    const key = normalizeMerchantName(name)
    return (
      key === needleKey ||
      key.includes(needleKey) ||
      needleKey.includes(key) ||
      name.toLowerCase().includes(needleLower)
    )
  })

  const sliced = matched.slice(0, rowLimit).map(mapPublicTransaction)
  const total = roundCurrency(
    matched.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0)
  )

  return {
    merchant: raw,
    days: lookback,
    matchCount: matched.length,
    total,
    transactions: sliced,
  }
}

export async function executeChatLookupTool(userId, toolName, input = {}) {
  if (toolName === 'get_category_transactions') {
    return getCategoryTransactions(userId, input)
  }
  if (toolName === 'get_merchant_history') {
    return getMerchantHistory(userId, input)
  }
  return { error: `Unknown tool: ${toolName}` }
}

export function buildChatToolsPromptHint() {
  return `

LOOKUP TOOLS — use when the snapshot is not enough:
- get_category_transactions: dig into a spending category (merchants + amounts + dates)
- get_merchant_history: dig into a specific merchant or payee
- Call a tool instead of guessing transaction-level detail. After results arrive, answer in plain language with those real dollars.
- Do not invent merchants or amounts that are not in the tool result or the live snapshot.
- Prefer one focused lookup over many. Cap yourself at a couple of tool calls unless the user asks for more.`
}

/*
 * What this does: turns a tool_use list into short UI status copy.
 * Why: tool rounds add latency; the chat bubble should say "checking
 * transactions" so the pause feels like work, not a freeze.
 */
export function formatChatLookupStatus(toolUses = []) {
  const uses = Array.isArray(toolUses) ? toolUses : []
  const merchantTool = uses.find((tool) => tool.name === 'get_merchant_history')
  const categoryTool = uses.find((tool) => tool.name === 'get_category_transactions')

  if (merchantTool) {
    const merchant = String(merchantTool.input?.merchant || '').trim()
    return {
      phase: 'looking_up',
      title: 'Checking your transactions…',
      detail: merchant
        ? `Looking up ${merchant}`
        : 'Looking up that merchant in your recent activity',
    }
  }

  if (categoryTool) {
    const category = String(categoryTool.input?.category || '').trim()
    return {
      phase: 'looking_up',
      title: 'Checking your transactions…',
      detail: category
        ? `Reviewing ${category} charges`
        : 'Reviewing that category in your recent activity',
    }
  }

  return {
    phase: 'looking_up',
    title: 'Checking your transactions…',
    detail: 'Pulling a few details so the answer stays accurate',
  }
}

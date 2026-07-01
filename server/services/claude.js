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
export async function generateFinancialSummary(transactions, accountSummary) {
  const formattedTransactions = formatTransactions(transactions)

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
${accountSummary}

Respond with ONLY this exact JSON structure, no other text:

{
  "headline": "One punchy sentence (max 15 words) capturing the single most important thing about this person's finances right now — can be a warning, a win, or a key fact",
  "headlineType": "warning" or "positive" or "neutral",
  "stats": [
    {
      "label": "short 2-3 word label",
      "value": "the key number, formatted with $ if money",
      "detail": "one short sentence of context, max 12 words"
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

fullSummary must be an array of exactly 3 strings. Each string is a complete standalone paragraph. Do not use line breaks within a single string — each paragraph is its own array element.

actions must be an array of exactly 3 strings. Each one is a specific, concrete next step the person can take this week. Use real numbers from their data when relevant. Order from most urgent/impactful to least.`,
        },
      ],
    })

    const rawText = response.content[0].text

    try {
      return parseClaudeJson(rawText)
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

/*
 * askFinancialQuestion(originalInsight, chatHistory, newQuestion, transactions, accountSummary)
 *
 * Conversational follow-up about a specific insight — returns plain text, not JSON.
 */
export async function askFinancialQuestion(
  originalInsight,
  chatHistory,
  newQuestion,
  transactions,
  accountSummary
) {
  const formattedTransactions = formatTransactions(transactions)
  const insightForPrompt = normalizeInsightForPrompt(originalInsight)
  const historyMessages = chatHistory.map(({ role, content }) => ({ role, content }))

  const systemPrompt = `You are Soverm, a personal AI CFO. You are having an ongoing conversation with a user about their finances.

You have two modes — use whichever fits the question:

1. DATA-SPECIFIC: If the question is about their personal finances, use the real numbers from their data below. Be specific, direct, and honest. Never vague.

2. GENERAL FINANCIAL KNOWLEDGE: If the question is a general finance question (e.g. "how do I open a savings account", "what's a Roth IRA", "should I pay off debt or invest", "what's compound interest"), answer it clearly and helpfully like a knowledgeable advisor would. Use plain English, no jargon. Keep it practical and actionable.

In both cases:
- Keep answers conversational and concise — 2-4 sentences for most questions, longer only if genuinely needed
- Never refuse a reasonable financial question
- Always be honest — don't sugarcoat bad financial habits
- End general advice answers with one sentence connecting it back to their situation if their data is relevant (e.g. "Given your current balance of $X, a HYSA would make sense as your next step.")
- You are not a licensed financial advisor — if someone asks about something requiring licensed advice (specific tax filing, legal contracts, investment management), briefly note that and suggest they consult a professional, then still give them the general knowledge you can

Their most recent insight:
${JSON.stringify(insightForPrompt)}

Their current financial data:
Transactions: ${formattedTransactions}
Accounts: ${accountSummary}

Chat history is provided in the messages array.

FORMATTING RULES:
- Write conversationally, like a knowledgeable friend
- Use markdown naturally when it aids clarity: bold for key terms, numbered lists for steps, bullet points for options
- Keep responses concise — 2-4 sentences for simple questions, structured lists only when genuinely helpful
- Short paragraphs, not walls of text
- Never start a response with "I" — lead with the substance
- Numbers and dollar amounts written naturally ($5,020 not 5020)`

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

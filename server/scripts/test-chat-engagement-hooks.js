/*
 * LIVE ENGAGEMENT-HOOK CHAT TEST
 *
 * Asks several questions in one thread and checks that analysis replies end
 * with a specific, useful follow-up question — not a repeated or generic CTA —
 * while a simple factual question does not force one.
 *
 * Usage:
 *   RUN_LIVE_CHAT_TESTS=1 node scripts/test-chat-engagement-hooks.js
 */

import 'dotenv/config'
import { buildAnswerQualityFixture } from './test-chat-live-responses.js'
import { askFinancialQuestion } from '../services/claude.js'
import {
  getReplyClosingLine,
  normalizeClosingQuestion,
  replyEndsWithQuestion,
  replyHasGenericClosingQuestion,
} from '../utils/chatAnswerQuality.js'
import { test } from 'node:test'

test('chat engagement hooks', async () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  const CASES = [
    {
      id: 'spending-spike',
      expectHook: true,
      question:
        'Food and Drink jumped a lot vs the prior 30 days — about $210 vs $150. Walk me through what that means and what I should do.',
    },
    {
      id: 'subscription',
      expectHook: true,
      question:
        'SparkFun looks like a recurring charge at about $89.40/mo. Should I keep it or cut it?',
    },
    {
      id: 'debt',
      expectHook: true,
      question:
        'I have about $400 on my credit card. How should I pay that down with what I have left until payday?',
    },
    {
      id: 'factual-balance',
      expectHook: false,
      question: "What's my total balance right now?",
    },
  ]

  async function main() {
    if (process.env.RUN_LIVE_CHAT_TESTS !== '1') {
      console.log('Skipped (set RUN_LIVE_CHAT_TESTS=1 to run live engagement tests).')
      return
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for live engagement tests')
    }

    console.log('Live engagement-hook chat tests\n')

    const fixture = buildAnswerQualityFixture()
    const history = []
    const closingQuestions = []

    for (const testCase of CASES) {
      const reply = await askFinancialQuestion(null, history, testCase.question, {
        chatFinancialContext: fixture,
        insightActions: [],
      })

      history.push({ role: 'user', content: testCase.question })
      history.push({ role: 'assistant', content: reply })

      const closing = getReplyClosingLine(reply)
      const endsWithQuestion = replyEndsWithQuestion(reply)
      const generic = replyHasGenericClosingQuestion(reply)

      console.log(`--- ${testCase.id} ---`)
      console.log(`Q: ${testCase.question}`)
      console.log(`Closing: ${closing}`)
      console.log()

      if (testCase.expectHook) {
        assert(endsWithQuestion, `${testCase.id}: analysis reply should end with a follow-up question`)
        assert(!generic, `${testCase.id}: closing question must not be generic filler`)
        const normalized = normalizeClosingQuestion(reply)
        assert(
          !closingQuestions.includes(normalized),
          `${testCase.id}: closing question repeated a prior hook`
        )
        closingQuestions.push(normalized)
      } else {
        assert(
          !endsWithQuestion,
          `${testCase.id}: simple factual reply should not force a closing question (got: ${closing})`
        )
      }

      console.log(`  pass: live ${testCase.id}`)
    }

    assert(closingQuestions.length >= 3, 'expected at least 3 distinct analysis hooks')
    console.log(`\n${CASES.length}/${CASES.length} live engagement-hook cases passed.`)
  }

  await main()
})

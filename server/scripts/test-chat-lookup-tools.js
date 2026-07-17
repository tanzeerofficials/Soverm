/*
 * Unit tests for chat lookup tool schemas + pure helpers.
 *
 * Usage: node scripts/test-chat-lookup-tools.js
 */

import assert from 'node:assert/strict'
import {
  CHAT_LOOKUP_TOOLS,
  buildChatToolsPromptHint,
  executeChatLookupTool,
  formatChatLookupStatus,
} from '../utils/chatLookupTools.js'

console.log('chatLookupTools tests\n')

assert.equal(CHAT_LOOKUP_TOOLS.length, 2, 'two lookup tools')
assert.ok(
  CHAT_LOOKUP_TOOLS.some((tool) => tool.name === 'get_category_transactions'),
  'category tool'
)
assert.ok(
  CHAT_LOOKUP_TOOLS.some((tool) => tool.name === 'get_merchant_history'),
  'merchant tool'
)

const hint = buildChatToolsPromptHint()
assert.ok(hint.includes('get_category_transactions'), 'hint names category tool')
assert.ok(hint.includes('get_merchant_history'), 'hint names merchant tool')

const categoryStatus = formatChatLookupStatus([
  { name: 'get_category_transactions', input: { category: 'Food and Drink' } },
])
assert.equal(categoryStatus.phase, 'looking_up')
assert.match(categoryStatus.detail, /Food and Drink/)

const merchantStatus = formatChatLookupStatus([
  { name: 'get_merchant_history', input: { merchant: 'Chipotle' } },
])
assert.match(merchantStatus.detail, /Chipotle/)

const unknown = await executeChatLookupTool('user_x', 'not_a_real_tool', {})
assert.ok(unknown.error, 'unknown tool returns error')

const missingCategory = await executeChatLookupTool('user_x', 'get_category_transactions', {})
assert.ok(missingCategory.error, 'category required')
assert.deepEqual(missingCategory.transactions, [])

const missingMerchant = await executeChatLookupTool('user_x', 'get_merchant_history', {
  merchant: '   ',
})
assert.ok(missingMerchant.error, 'merchant required')

console.log('  pass: tool schemas + validation + status copy')
console.log('\nAll chatLookupTools tests passed.')

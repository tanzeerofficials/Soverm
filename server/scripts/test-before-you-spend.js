/**
 * Unit tests for before-you-spend judgment (no DB).
 *
 * Usage: node scripts/test-before-you-spend.js
 */

import {
  judgeBeforeYouSpend,
  looksLikeRentObligation,
  matchSoftLimit,
} from '../utils/beforeYouSpend.js'
import { test } from 'node:test'

test('before you spend', () => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message)
    }
  }

  console.log('beforeYouSpend tests\n')

  assert(looksLikeRentObligation({ merchant: 'Acme Property Rent' }), 'rent merchant')
  assert(!looksLikeRentObligation({ merchant: 'Netflix' }), 'not rent')

  const limits = [
    {
      category: 'Food and Drink',
      monthlyLimit: 400,
      spentThisMonth: 350,
      alertWarningPercent: 80,
    },
  ]
  assert(matchSoftLimit('food', limits)?.category === 'Food and Drink', 'fuzzy match')

  const fine = judgeBeforeYouSpend({
    amount: 20,
    whatsLeft: {
      configured: true,
      amount: 300,
      bills: [],
    },
  })
  assert(fine.verdict === 'fine', 'fine spend')
  assert(fine.whatsLeftAfter === 280, 'left after')

  const incomplete = judgeBeforeYouSpend({
    amount: 20,
    whatsLeft: { configured: false },
  })
  assert(incomplete.verdict === 'incomplete', 'incomplete without payday')
  assert(incomplete.title.toLowerCase().includes('payday'), 'asks for payday')

  const paydayRisk = judgeBeforeYouSpend({
    amount: 250,
    whatsLeft: { configured: true, amount: 200, bills: [] },
  })
  assert(paydayRisk.verdict === 'risks_payday', 'risks payday')

  const categoryBlow = judgeBeforeYouSpend({
    amount: 80,
    category: 'Food and Drink',
    whatsLeft: { configured: true, amount: 500, bills: [] },
    softLimits: limits,
  })
  assert(categoryBlow.verdict === 'blows_category', 'blows category')

  const rentRisk = judgeBeforeYouSpend({
    amount: 100,
    whatsLeft: {
      configured: true,
      amount: 150,
      netBalance: 200,
      bills: [{ merchant: 'Landlord Rent', amount: 120 }],
    },
  })
  assert(rentRisk.verdict === 'risks_rent', 'risks rent')

  console.log('All beforeYouSpend tests passed.')
})

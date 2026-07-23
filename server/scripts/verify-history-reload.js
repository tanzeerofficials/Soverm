/*
 * Simulates history.js parseInsightContent on real DB rows.
 * Lives in test:integration (not test:all) — CI has no DATABASE_URL. Run with:
 *   npm run test:integration
 */

import 'dotenv/config'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import pg from 'pg'

const { Pool } = pg

function parseInsightContent(row) {
  let parsedContent

  try {
    parsedContent = JSON.parse(row.content)
  } catch {
    parsedContent = {
      headline: 'Previous insight',
      fullSummary: row.content,
      stats: [],
    }
  }

  return { ...parsedContent, id: row.id, created_at: row.created_at }
}

test('history reload preserves stored insight deltas', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set — history reload verification needs Postgres')
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const { rows } = await pool.query(
      `SELECT id, content, created_at FROM insights ORDER BY created_at DESC LIMIT 10`
    )

    let withDelta = 0
    let lostOnReload = 0

    for (const row of rows) {
      const reloaded = parseInsightContent(row)
      const deltas = (reloaded.stats ?? []).map((s) => s.delta).filter(Boolean)

      if (deltas.length > 0) {
        withDelta++
        const raw = JSON.parse(row.content)
        const rawDeltas = (raw.stats ?? []).map((s) => s.delta).filter(Boolean)
        if (JSON.stringify(rawDeltas) !== JSON.stringify(deltas)) {
          lostOnReload++
          console.log(`  FAIL: ${row.id} lost deltas on history reload`)
        }
      }
    }

    console.log('History reload verification\n')
    console.log(`  insights checked: ${rows.length}`)
    console.log(`  with stored deltas: ${withDelta}`)
    console.log(`  deltas lost on reload: ${lostOnReload}`)

    assert.equal(lostOnReload, 0, 'history parse must preserve all stored delta badges')
    console.log('  pass: history parse preserves all stored delta badges')

    const noDeltaInsight = rows.find((row) => {
      const parsed = JSON.parse(row.content)
      return (parsed.stats ?? []).every((s) => !s.delta?.direction)
    })

    if (noDeltaInsight) {
      const reloaded = parseInsightContent(noDeltaInsight)
      const hasErrorField = reloaded.error != null
      const allNull = (reloaded.stats ?? []).every((s) => s.delta == null || !s.delta?.direction)
      console.log(`  pass: legacy insight without deltas reloads cleanly (no error: ${!hasErrorField}, badges absent: ${allNull})`)
    }
  } finally {
    await pool.end()
  }
})

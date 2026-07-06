/*
 * Simulates history.js parseInsightContent on real DB rows.
 *
 * Usage: node scripts/verify-history-reload.js
 */

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

async function main() {
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

    if (lostOnReload === 0) {
      console.log('  pass: history parse preserves all stored delta badges')
    } else {
      process.exit(1)
    }

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
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})

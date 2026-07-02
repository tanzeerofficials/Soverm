/*
 * Validates persisted insight rows in Postgres (optional live DB check).
 *
 * Usage: node scripts/verify-stored-insights.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const { Pool } = pg

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('SKIP: DATABASE_URL not set — using integration tests only')
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const { rows } = await pool.query(
      `SELECT id, content, created_at
       FROM insights
       ORDER BY created_at DESC
       LIMIT 5`
    )

    if (rows.length === 0) {
      console.log('DB: no insights stored yet — generate one in the app to complete live verification')
      return
    }

    console.log(`DB: inspecting ${rows.length} most recent insight(s)\n`)

    for (const row of rows) {
      let content
      try {
        content = JSON.parse(row.content)
      } catch {
        console.log(`  ${row.id}: legacy non-JSON content (pre-structured insights)`)
        continue
      }

      const hasMom = content.monthOverMonthComparison != null
      const statsWithDelta = (content.stats ?? []).filter((s) => s.delta?.direction)
      const staleCopy = JSON.stringify(content).includes('vs last month')
      const correctCopy = statsWithDelta.every(
        (s) => !s.delta?.vsLabel || s.delta.vsLabel === 'vs prior 30 days'
      )

      console.log(`  ${row.id.slice(0, 8)}… (${row.created_at.toISOString().slice(0, 10)})`)
      console.log(`    MoM snapshot saved: ${hasMom ? 'yes' : 'no (generated before fix #5)'}`)
      console.log(`    stats with delta badges: ${statsWithDelta.length}`)
      console.log(`    stale "vs last month" copy: ${staleCopy ? 'YES — needs regen' : 'none'}`)
      console.log(`    delta vsLabel correct: ${correctCopy ? 'yes' : 'mixed/legacy'}`)

      const metadata = content.metadata
      if (metadata) {
        console.log(`    metadata.generatedAt: ${metadata.generatedAt}`)
        console.log(`    metadata.transactionCount: ${metadata.transactionCount}`)
        console.log(`    metadata.comparisonWindow: ${metadata.comparisonWindow}`)
      } else {
        console.log('    metadata: missing (generate a fresh insight to populate)')
      }

      const incomeStats = (content.stats ?? []).filter(
        (s) => s.statType === 'income' || /income|paycheck|deposit/i.test(s.label ?? '')
      )
      if (incomeStats.length > 0) {
        for (const stat of incomeStats) {
          console.log(
            `    income stat "${stat.label}": delta ${stat.delta ? `${stat.delta.direction} ${stat.delta.percent}%` : 'null'}`
          )
        }
      }

      if (hasMom && statsWithDelta.length > 0) {
        const stat = statsWithDelta[0]
        const mom = content.monthOverMonthComparison
        console.log(`    sample stat: "${stat.label}" → ${stat.delta.direction} ${stat.delta.percent}%`)
        console.log(
          `    frozen prior spending: $${mom.priorPeriod?.spending?.total ?? mom.priorPeriod?.total ?? 'n/a'}, income: $${mom.priorPeriod?.income?.total ?? 'n/a'}`
        )
      }
      console.log('')
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('DB verify failed:', err.message)
  process.exit(1)
})

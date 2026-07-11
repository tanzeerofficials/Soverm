/*
 * Backward-compatible entry point — delegates to verify-all-migrations.js
 * (covers 006–018, including trackers and spending-cap notification types).
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' node scripts/verify-migrations.js
 *   DATABASE_URL='postgresql://...' node scripts/verify-migrations.js --apply
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.join(__dirname, 'verify-all-migrations.js')
const args = process.argv.slice(2)

const child = spawn(process.execPath, [target, ...args], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

/*
 * SENTRY INSTRUMENTATION (load first)
 *
 * Sentry must initialize before Express and other modules load.
 * Started via: node --import ./instrument.js index.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '.env') })

const { initSentry } = await import('./utils/sentry.js')
initSentry()

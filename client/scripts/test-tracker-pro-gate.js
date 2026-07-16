/*
 * Verifies Free vs Pro tracker access (1 spending cap free; savings/alerts Pro).
 *
 * Usage: node scripts/test-tracker-pro-gate.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const quickToolsSource = readFileSync(
  join(__dirname, '../src/components/quickTools/DashboardQuickTools.jsx'),
  'utf8'
)
const trackerPanelSource = readFileSync(
  join(__dirname, '../src/components/quickTools/TrackerToolPanel.jsx'),
  'utf8'
)
const pricingSource = readFileSync(
  join(__dirname, '../src/components/PricingSection.jsx'),
  'utf8'
)
const calloutSource = readFileSync(
  join(__dirname, '../src/components/FreeVsProPlanCallout.jsx'),
  'utf8'
)
const trackersRouteSource = readFileSync(
  join(__dirname, '../../server/routes/trackers.js'),
  'utf8'
)
const usageSource = readFileSync(
  join(__dirname, '../../server/utils/usage.js'),
  'utf8'
)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

try {
  console.log('Tracker Free/Pro gate tests\n')

  assert(
    quickToolsSource.includes('isPro={isPro}'),
    'DashboardQuickTools must pass isPro into TrackerToolPanel'
  )
  assert(
    !quickToolsSource.includes('ProFeatureGate'),
    'Free users should see TrackerToolPanel, not a full ProFeatureGate lock'
  )
  assert(
    trackerPanelSource.includes('allowCustomAlerts={isPro}'),
    'TrackerToolPanel must gate custom alerts behind Pro'
  )
  assert(
    trackerPanelSource.includes('allowSaving={isPro}'),
    'TrackerToolPanel must gate savings creation behind Pro'
  )
  assert(
    trackersRouteSource.includes('assertTrackerCreateAllowed'),
    'trackers routes must use tier-aware create checks'
  )
  assert(
    usageSource.includes('assertTrackerCreateAllowed'),
    'usage.js must export assertTrackerCreateAllowed'
  )
  assert(
    pricingSource.includes('1 spending cap'),
    'Pricing must show Free includes one spending cap'
  )
  assert(
    calloutSource.includes('Free tells you where you stand'),
    'Dashboard Free vs Pro callout must explain the plan split'
  )

  console.log('  pass: free spending-cap + Pro depth wiring')
  console.log('\nAll tracker Free/Pro gate checks passed')
} catch (err) {
  console.error(`\nFAIL: ${err.message}`)
  process.exit(1)
}

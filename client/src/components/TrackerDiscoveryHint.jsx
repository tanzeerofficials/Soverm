/*
 * TRACKER DISCOVERY HINT
 *
 * Short Overview callout so first-time testers find spending/savings trackers
 * under Home → Quick tools → Tracker (easy to miss on the Tools tab).
 */

import { useAuth } from '@clerk/clerk-react'
import { useState } from 'react'
import {
  readUserScopedJson,
  writeUserScopedJson,
} from '../lib/userScopedStorage.js'

export const TRACKER_HINT_STORAGE_KEY = 'soverm:tracker-discovery-hint'

function TrackerDiscoveryHint({ hasTrackerConfigured = false, onOpenTracker }) {
  const { userId } = useAuth()
  const [dismissed, setDismissed] = useState(() =>
    Boolean(readUserScopedJson(TRACKER_HINT_STORAGE_KEY, userId, { dismissed: false })?.dismissed)
  )

  if (!userId || dismissed || hasTrackerConfigured) {
    return null
  }

  function dismiss() {
    writeUserScopedJson(TRACKER_HINT_STORAGE_KEY, userId, { dismissed: true })
    setDismissed(true)
  }

  return (
    <section
      className="rounded-xl border border-border-default border-l-4 border-l-ai bg-surface px-4 py-3 text-left sm:px-5"
      aria-label="Find your spending tracker"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
            Tip
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">
            Set a spending cap or savings goal
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Trackers live under{' '}
            <span className="font-medium text-fg">Quick tools → Tracker</span> on the Tools tab —
            same Home page, one tap away.
          </p>
          {typeof onOpenTracker === 'function' && (
            <button
              type="button"
              onClick={onOpenTracker}
              className="mt-3 rounded-lg bg-ai/15 px-3 py-1.5 text-xs font-semibold text-ai-soft transition hover:bg-ai/25"
            >
              Open Tracker
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-fg-muted transition hover:text-fg"
          aria-label="Dismiss tracker tip"
        >
          Dismiss
        </button>
      </div>
    </section>
  )
}

export default TrackerDiscoveryHint

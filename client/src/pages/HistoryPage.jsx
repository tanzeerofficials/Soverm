/*
 * HISTORY PAGE
 *
 * Archive of past AI financial insights — grouped timeline with search
 * and summary stats. Tapping an entry opens the full InsightCard in a modal.
 */

import { useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import PageHeader from '../components/PageHeader.jsx'
import HistoryInsightEntry from '../components/HistoryInsightEntry.jsx'
import HistoryInsightModal from '../components/HistoryInsightModal.jsx'
import HistoryTimelineSkeleton from '../components/HistoryTimelineSkeleton.jsx'
import { historyQueryKey } from '../lib/queryKeys.js'
import { formatInsightDate } from '../lib/formatInsightDate.js'
import { groupInsightsByMonth } from '../lib/historyTimeline.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { trackUpgradeProClick } from '../lib/analytics.js'

function HistoryMetaChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border-default bg-surface px-2.5 py-1 text-xs text-fg-muted">
      {children}
    </span>
  )
}

function HistoryLockedBanner({ lockedCount, onUpgrade }) {
  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-warning/30 bg-surface p-4 sm:p-5">
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {lockedCount} earlier insight{lockedCount === 1 ? '' : 's'} locked
          </p>
          <p className="mt-1 max-w-lg text-xs leading-relaxed text-fg-muted">
            Free keeps 7 days. Soverm Pro unlocks your full archive.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="shrink-0 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-app transition hover:brightness-110"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  )
}

function HistoryEmptyState() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border-default bg-surface/50 px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border-default bg-app text-ai">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </div>
      <p className="mt-5 text-base font-semibold text-fg">No insights yet</p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Generate your first insight from the dashboard — it will appear here as part of your
        financial archive.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-soft"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}

function HistoryPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const [selectedInsight, setSelectedInsight] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: historyQueryKey,
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(`History fetch failed: ${res.status}`)
      }
      return res.json()
    },
  })

  const insights = historyData?.insights ?? []
  const lockedCount = historyData?.lockedCount ?? 0
  const isPro = historyData?.usage?.isPro ?? false

  const filteredInsights = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return insights
    }

    return insights.filter((insight) => {
      const dateLabel = formatInsightDate(insight.created_at) ?? ''
      const headline = insight.headline ?? ''
      const haystack = `${dateLabel} ${headline}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [insights, searchQuery])

  const groupedInsights = useMemo(
    () => groupInsightsByMonth(filteredInsights),
    [filteredInsights]
  )

  function handleUpgrade() {
    trackUpgradeProClick('history')
    showToast('Soverm Pro checkout is coming soon — stay tuned!', 'success')
  }

  function handleCloseModal() {
    setSelectedInsight(null)
  }

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        onChatClick={() => navigate('/dashboard?chat=open')}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader
          title="Insight History"
          description="Your past insights, organized by date."
        />

        {!historyLoading && (insights.length > 0 || lockedCount > 0) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <HistoryMetaChip>
              <span className="font-mono font-semibold tabular-nums text-fg">
                {insights.length}
              </span>
              <span className="ml-1">visible</span>
            </HistoryMetaChip>
            <HistoryMetaChip>
              {isPro ? 'Unlimited retention' : 'Last 7 days on Free'}
            </HistoryMetaChip>
            {lockedCount > 0 && (
              <HistoryMetaChip>
                <span className="font-mono font-semibold tabular-nums text-warning">
                  {lockedCount}
                </span>
                <span className="ml-1">locked</span>
              </HistoryMetaChip>
            )}
          </div>
        )}

        {historyLoading ? (
          <div aria-busy="true" aria-label="Loading insights">
            <HistoryTimelineSkeleton />
          </div>
        ) : insights.length === 0 && lockedCount === 0 ? (
          <HistoryEmptyState />
        ) : (
          <div className="mx-auto max-w-3xl">
            {insights.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative min-w-0 flex-1">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by date or headline…"
                      className={`w-full rounded-lg border border-border-default bg-surface py-2.5 pl-10 text-sm text-fg placeholder:text-fg-subtle focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 ${searchQuery ? 'pr-10' : 'pr-4'}`}
                      aria-label="Search insights"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
                        aria-label="Clear search"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-fg-subtle">
                    {filteredInsights.length} of {insights.length}
                  </p>
                </div>
              </div>
            )}

            {filteredInsights.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface px-6 py-12 text-center">
                <p className="text-sm font-medium text-fg">No matching insights</p>
                <p className="mt-2 text-sm text-fg-muted">
                  Try a different month, date, or headline keyword.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-sm font-medium text-ai transition hover:text-ai-soft"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                {groupedInsights.map((group) => (
                  <section key={group.key} aria-labelledby={`history-month-${group.key}`}>
                    <div className="sticky top-16 z-10 mb-5 flex items-center gap-3 bg-app/90 py-2 backdrop-blur-sm">
                      <h2
                        id={`history-month-${group.key}`}
                        className="text-xs font-semibold uppercase tracking-[0.25em] text-fg-muted"
                      >
                        {group.label}
                      </h2>
                      <span className="h-px flex-1 bg-gradient-to-r from-border-default to-transparent" />
                      <span className="rounded-full border border-border-default bg-surface px-2 py-0.5 text-[11px] font-medium tabular-nums text-fg-subtle">
                        {group.insights.length}
                      </span>
                    </div>

                    <div className="relative space-y-4 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-gradient-to-b before:from-border-default before:via-fg-subtle/40 before:to-transparent">
                      {group.insights.map((insight) => (
                        <HistoryInsightEntry
                          key={insight.id}
                          insight={insight}
                          onSelect={setSelectedInsight}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {lockedCount > 0 && (
              <HistoryLockedBanner lockedCount={lockedCount} onUpgrade={handleUpgrade} />
            )}
          </div>
        )}
      </main>

      <HistoryInsightModal
        isOpen={selectedInsight !== null}
        insight={selectedInsight}
        onClose={handleCloseModal}
        onChatError={(message) => showToast(message, 'error')}
      />
    </div>
  )
}

export default HistoryPage

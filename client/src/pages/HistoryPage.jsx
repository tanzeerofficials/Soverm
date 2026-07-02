/*
 * HISTORY PAGE
 *
 * Lists all past AI financial insights as a compact dated timeline.
 * Tapping an entry opens the full InsightCard in a modal.
 */

import { useMemo, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import HistoryInsightEntry from '../components/HistoryInsightEntry.jsx'
import HistoryInsightModal from '../components/HistoryInsightModal.jsx'
import HistoryTimelineSkeleton from '../components/HistoryTimelineSkeleton.jsx'
import { historyQueryKey } from '../lib/queryKeys.js'
import { formatInsightDate } from '../lib/formatInsightDate.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { trackUpgradeProClick } from '../lib/analytics.js'

function HistoryLockedBanner({ lockedCount, onUpgrade }) {
  return (
    <div className="mt-4 rounded-xl border border-[#1E2D45] bg-[#111827] p-6 text-center">
      <p className="text-sm font-semibold text-[#F9FAFB]">
        {lockedCount} earlier insight{lockedCount === 1 ? '' : 's'} locked
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#9CA3AF]">
        Free accounts keep the last 7 days of history. Soverm Pro keeps everything,
        forever.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 rounded-lg bg-[#F59E0B] px-5 py-2.5 text-sm font-semibold text-[#0A0F1C] transition hover:bg-[#FBBF24]"
      >
        Upgrade to Soverm Pro
      </button>
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

  const filteredInsights = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return insights
    }

    return insights.filter((insight) => {
      const dateLabel = formatInsightDate(insight.created_at)
      if (!dateLabel) {
        return false
      }
      return dateLabel.toLowerCase().includes(query)
    })
  }, [insights, searchQuery])

  function handleUpgrade() {
    trackUpgradeProClick('history')
    showToast('Soverm Pro checkout is coming soon — stay tuned!', 'success')
  }

  function handleCloseModal() {
    setSelectedInsight(null)
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        onChatClick={() => navigate('/dashboard?chat=open')}
        leftContent={
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-[#9CA3AF] transition hover:text-white"
            >
              ← Back to Dashboard
            </Link>
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]">
              Soverm
            </span>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#F9FAFB]">Your Insight History</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Your financial story, one insight at a time.
          </p>
        </div>

        {historyLoading ? (
          <div aria-busy="true" aria-label="Loading insights">
            <HistoryTimelineSkeleton />
          </div>
        ) : insights.length === 0 && lockedCount === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-[#9CA3AF]">
              No insights yet. Generate your first one from the dashboard.
            </p>
            <Link
              to="/dashboard"
              className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-3xl space-y-3">
              {insights.length > 0 && (
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
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
                    placeholder="Search by month or date — e.g. June or July 1"
                    className={`w-full rounded-lg border border-[#1E2D45] bg-[#111827] py-3 pl-10 text-sm text-[#F9FAFB] placeholder:text-[#6B7280] focus:border-[#374151] focus:outline-none ${searchQuery ? 'pr-10' : 'pr-4'}`}
                    aria-label="Search insights by date"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#9CA3AF] transition hover:bg-[#1A2236] hover:text-white"
                      aria-label="Clear search"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {filteredInsights.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#9CA3AF]">
                  No insights found for that date
                </p>
              ) : (
                filteredInsights.map((insight) => (
                  <HistoryInsightEntry
                    key={insight.id}
                    insight={insight}
                    onSelect={setSelectedInsight}
                  />
                ))
              )}
            </div>

            {lockedCount > 0 && (
              <HistoryLockedBanner lockedCount={lockedCount} onUpgrade={handleUpgrade} />
            )}
          </>
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

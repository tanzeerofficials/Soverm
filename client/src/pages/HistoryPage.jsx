/*
 * HISTORY PAGE
 *
 * Lists all past AI financial insights and their action items.
 */

import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import InsightCard from '../components/InsightCard'
import InsightCardSkeleton from '../components/InsightCardSkeleton.jsx'
import { historyQueryKey } from '../lib/queryKeys.js'
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

  function handleUpgrade() {
    trackUpgradeProClick('history')
    showToast('Soverm Pro checkout is coming soon — stay tuned!', 'success')
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <AppNavbar
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
            Every financial summary Soverm has generated for you
          </p>
        </div>

        {historyLoading ? (
          <div className="space-y-8" aria-busy="true" aria-label="Loading insights">
            {[0, 1, 2].map((index) => (
              <InsightCardSkeleton key={index} />
            ))}
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
            {insights.map((insight) => (
              <div key={insight.id} className="mb-8">
                <InsightCard
                  insight={insight}
                  onChatError={(message) => showToast(message, 'error')}
                />
              </div>
            ))}

            {lockedCount > 0 && (
              <HistoryLockedBanner lockedCount={lockedCount} onUpgrade={handleUpgrade} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default HistoryPage

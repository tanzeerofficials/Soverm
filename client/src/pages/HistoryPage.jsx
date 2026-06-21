/*
 * HISTORY PAGE
 *
 * Lists all past AI financial insights and their action items.
 */

import { useEffect, useState } from 'react'
import { SignOutButton, useAuth, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import InsightCard from '../components/InsightCard'
import ActionChecklist from '../components/ActionChecklist'

function HistoryPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()

  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const token = await getToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/history`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()
        if (response.ok) {
          setInsights(data.insights)
        }
      } catch (err) {
        console.error('Failed to fetch insight history:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [getToken])

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#1E2D45] bg-[#0A0F1C]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
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

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-[#9CA3AF] sm:inline">{firstName}</span>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
              aria-hidden="true"
            >
              {initials}
            </div>
            <SignOutButton>
              <button
                type="button"
                className="rounded-lg border border-[#1E2D45] bg-[#111827] px-3 py-1.5 text-xs font-medium text-[#F9FAFB] transition hover:bg-[#1A2236] sm:px-4 sm:text-sm"
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-[#F9FAFB]">Your Insight History</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Every financial summary Soverm has generated for you
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-[#9CA3AF]">Loading your history...</p>
          </div>
        ) : insights.length === 0 ? (
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
          insights.map((insight) => (
            <div key={insight.id} className="mb-8">
              <InsightCard insight={insight} />
              {insight.actions?.length > 0 && (
                <ActionChecklist actions={insight.actions} />
              )}
            </div>
          ))
        )}
      </main>
    </div>
  )
}

export default HistoryPage

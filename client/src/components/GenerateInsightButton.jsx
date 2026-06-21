/*
 * GENERATE INSIGHT BUTTON
 *
 * This button asks our backend to analyze recent transactions
 * with Claude and return a plain-English financial summary.
 *
 * Big picture steps:
 * 1) Get Clerk login token (proves who you are)
 * 2) POST to /api/insights/generate
 * 3) Display the AI summary in a card below the button
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

/*
 * GenerateInsightButton
 *
 * What it does:
 * - Triggers AI financial summary generation
 * - Shows loading, error, and success states
 *
 * Why we need getToken() (same as ConnectBankButton / SyncTransactionsButton):
 * - POST /api/insights/generate uses getAuth(req) on the server
 * - Without Authorization: Bearer, the route returns 401
 * - getToken() turns the Clerk browser session into that JWT
 *
 * Important concepts:
 * - useState: holds insight text, loading flag, and error message
 * - async/await: Claude takes a few seconds; we wait for the full response
 */
function GenerateInsightButton({
  className = '',
  showCard = true,
  showToast,
  onSyncComplete,
  onInsightGenerated,
  onError,
  onLoadingChange,
}) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState(null)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setLoading(true)
    onLoadingChange?.(true)
    setError(null)

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/insights/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate insight')
      }

      setInsight(data.insight)
      const insightWithActions = {
        ...data.insight,
        actions: (data.insight.actions ?? []).map((description, index) => ({
          id: data.actionIds?.[index],
          description,
          completed: false,
        })),
      }
      onInsightGenerated?.(insightWithActions)
      showToast?.('Financial summary generated', 'success')
      onSyncComplete?.()
    } catch (err) {
      console.error('Insight generation failed:', err.message)
      setError(err.message)
      onError?.(err.message)
      setInsight(null)
      showToast?.('Insight generation failed — please try again', 'error')
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading ? 'Analyzing...' : 'Generate Summary'}
    </button>
  )

  if (!showCard) {
    return button
  }

  return (
    <div className="flex flex-col gap-4">
      {button}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {insight && (
        <div className="rounded-lg border-l-4 border-emerald-500 bg-slate-800 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
            Your Financial Summary
          </p>
          <p className="mt-3 leading-relaxed text-slate-100">{insight}</p>
        </div>
      )}
    </div>
  )
}

export default GenerateInsightButton

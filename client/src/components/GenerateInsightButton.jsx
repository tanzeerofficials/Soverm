/*
 * GENERATE INSIGHT BUTTON
 *
 * This button asks our backend to analyze recent transactions
 * with Claude and return a plain-English financial summary.
 */

import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { dashboardQueryKey, historyQueryKey } from '../lib/queryKeys.js'
import {
  trackGenerateInsightClick,
  trackGenerateInsightResult,
} from '../lib/analytics.js'
import { captureClientError } from '../lib/sentry.js'

function GenerateInsightButton({
  className = '',
  showCard = true,
  showToast,
  onInsightGenerated,
  onError,
  onLoadingChange,
  onLimitReached,
  onUsageUpdated,
  highlighted = false,
  isLoading: isLoadingProp = false,
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [internalLoading, setInternalLoading] = useState(false)
  const [insight, setInsight] = useState(null)
  const [error, setError] = useState(null)
  const loading = isLoadingProp || internalLoading

  async function handleGenerate() {
    trackGenerateInsightClick()
    setInternalLoading(true)
    onLoadingChange?.(true)
    setError(null)
    onLimitReached?.(false)

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
        if (data.error === 'limit_reached') {
          trackGenerateInsightResult('paywall')
          onLimitReached?.(true)
          onUsageUpdated?.(data.usage)
          return
        }
        if (data.error === 'rate_limit_exceeded') {
          trackGenerateInsightResult('error')
          const message =
            data.message || 'Daily insight limit reached. Try again tomorrow.'
          showToast?.(message, 'error')
          onError?.(message)
          return
        }
        throw new Error(data.message || data.error || 'Failed to generate insight')
      }

      const insightWithActions = {
        ...data.insight,
        id: data.insightId,
        actions: (data.insight.actions ?? []).map((description, index) => ({
          id: data.actionIds?.[index],
          description,
          completed: false,
        })),
      }

      setInsight(data.insight)
      onInsightGenerated?.(insightWithActions)
      onError?.(null)
      onUsageUpdated?.(data.usage)
      trackGenerateInsightResult('success')
      showToast?.('Insight generated', 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
        queryClient.invalidateQueries({ queryKey: historyQueryKey }),
      ])
    } catch (err) {
      captureClientError(err, { label: 'generate_insight' })
      console.error('Insight generation failed:', err.message)
      trackGenerateInsightResult('error')
      setError(err.message)
      onError?.(err.message)
      setInsight(null)
      showToast?.('Insight generation failed — please try again', 'error')
    } finally {
      setInternalLoading(false)
      onLoadingChange?.(false)
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className={`min-h-11 rounded-lg border border-ai/45 bg-ai/12 px-4 py-3 text-sm font-semibold text-ai-soft transition hover:border-ai/65 hover:bg-ai/22 disabled:cursor-not-allowed disabled:opacity-60 ${
        highlighted && !loading ? 'animate-pulse ring-2 ring-ai/50 ring-offset-2 ring-offset-app' : ''
      } ${className}`}
    >
      {loading ? 'Generating insights…' : 'Generate Insights'}
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

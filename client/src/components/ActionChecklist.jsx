/*
 * ACTION CHECKLIST
 *
 * Insight action items with progress bar and optimistic checkbox toggling
 * synced to the server.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { summarizeInsightActions } from '../lib/dashboardAttention.js'
import { dashboardQueryKey } from '../lib/queryKeys.js'

function normalizeActions(actions) {
  return (actions ?? []).map((action, index) => {
    if (typeof action === 'string') {
      return {
        id: `pending-${index}-${action}`,
        description: action,
        completed: false,
      }
    }

    return {
      id: action.id ?? `pending-${index}-${action.description ?? ''}`,
      description: action.description ?? '',
      completed: Boolean(action.completed),
    }
  })
}

function ActionChecklist({ actions, onUpdate, id = 'dashboard-insight-actions', className = '' }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [localActions, setLocalActions] = useState(() => normalizeActions(actions))

  useEffect(() => {
    setLocalActions(normalizeActions(actions))
  }, [actions])

  const { total, completed } = summarizeInsightActions(localActions)
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

  async function handleToggle(actionId, currentCompleted) {
    if (String(actionId).startsWith('pending-')) {
      return
    }
    const nextCompleted = !currentCompleted

    setLocalActions((prev) =>
      prev.map((action) =>
        action.id === actionId ? { ...action, completed: nextCompleted } : action
      )
    )

    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed: nextCompleted }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update action')
      }

      setLocalActions((prev) => {
        onUpdate?.(prev)
        return prev
      })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (err) {
      console.error('Failed to toggle action:', err.message)
      setLocalActions((prev) =>
        prev.map((action) =>
          action.id === actionId ? { ...action, completed: currentCompleted } : action
        )
      )
    }
  }

  if (!localActions || localActions.length === 0) {
    return null
  }

  return (
    <section
      id={id}
      className={`rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-4 sm:p-5 ${className}`}
      aria-label="Insight action checklist"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand">
            This week&apos;s actions
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">
            {completed === total ? (
              <span className="text-brand-soft">All {total} actions complete</span>
            ) : (
              <>
                {completed} of {total} complete
              </>
            )}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-fg-muted">{progressPercent}%</span>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-elevated"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${completed} of ${total} insight actions complete`}
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1">
        {localActions.map((action) => (
          <li
            key={action.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-elevated/60"
          >
            <button
              type="button"
              onClick={() => handleToggle(action.id, action.completed)}
              aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
              aria-pressed={action.completed}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${
                action.completed
                  ? 'border-brand bg-brand'
                  : 'border-border-default bg-transparent'
              }`}
            >
              {action.completed && (
                <svg
                  className="h-3 w-3 text-fg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            <span
              className={`text-sm transition ${
                action.completed ? 'text-fg-subtle line-through' : 'text-fg'
              }`}
            >
              {action.description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ActionChecklist

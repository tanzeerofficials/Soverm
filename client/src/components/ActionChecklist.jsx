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
import { dashboardQueryKey, trackerQueryKey } from '../lib/queryKeys.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { parseSavingsActionSuggestion } from '../lib/parseSavingsAction.js'
import { updateActionLifecycle } from '../lib/fetchActions.js'
import { createTracker } from '../lib/fetchTrackers.js'
import { toUserFacingErrorMessage } from '../lib/userFacingError.js'

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
      completed: Boolean(action.completed) || action.status === 'done',
      status: action.status ?? (action.completed ? 'done' : 'suggested'),
      source: action.source ?? 'insight',
    }
  })
}

function ActionChecklist({ actions, onUpdate, id = 'dashboard-insight-actions', className = '' }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()
  const [localActions, setLocalActions] = useState(() => normalizeActions(actions))

  useEffect(() => {
    setLocalActions(normalizeActions(actions))
  }, [actions])

  const { total, completed } = summarizeInsightActions(localActions)
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

  /*
   * What this does: turns a "Save $X…" action into a real savings tracker.
   * Why: closes the loop from insight advice → a goal people can track.
   */
  async function handleCreateSavingsGoal(action) {
    const suggestion = parseSavingsActionSuggestion(action.description)
    if (!suggestion) {
      return
    }

    try {
      await createTracker(getToken, {
        trackType: 'saving',
        name: suggestion.name,
        purposeType: suggestion.purposeType,
        monthlyAmount: suggestion.monthlyAmount,
      })
      showToast?.(`Savings goal created — $${suggestion.monthlyAmount}/mo`, 'success')
      await queryClient.invalidateQueries({ queryKey: trackerQueryKey })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (err) {
      console.error('Failed to create savings goal from action:', err.message)
      showToast?.(
        toUserFacingErrorMessage(err, 'Couldn’t create that savings goal'),
        'error'
      )
    }
  }

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
      await updateActionLifecycle(getToken, actionId, { completed: nextCompleted })

      setLocalActions((prev) => {
        onUpdate?.(prev)
        return prev
      })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (err) {
      console.error('Failed to toggle action:', err.message)
      showToast?.('Couldn’t update that action — please try again', 'error')
      setLocalActions((prev) =>
        prev.map((action) =>
          action.id === actionId ? { ...action, completed: currentCompleted } : action
        )
      )
    }
  }

  async function handleSkip(actionId) {
    if (String(actionId).startsWith('pending-')) {
      return
    }

    setLocalActions((prev) =>
      prev.map((action) =>
        action.id === actionId ? { ...action, status: 'skipped', completed: false } : action
      )
    )

    try {
      await updateActionLifecycle(getToken, actionId, { status: 'skipped' })
      showToast?.('Action skipped', 'success')
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
    } catch (_err) {
      showToast?.('Couldn’t skip that action', 'error')
    }
  }

  if (!localActions || localActions.length === 0) {
    return null
  }

  return (
    <section
      id={id}
      className={`rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-4 sm:p-5 card-shadow ${className}`}
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
        {localActions.map((action) => {
          const savingsSuggestion =
            !action.completed && parseSavingsActionSuggestion(action.description)

          return (
            <li
              key={action.id}
              className="flex flex-col gap-2 rounded-lg px-2 py-2 transition hover:bg-surface-elevated/60"
            >
              <div className="flex items-center gap-3">
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
              </div>
              {savingsSuggestion ? (
                <button
                  type="button"
                  onClick={() => handleCreateSavingsGoal(action)}
                  className="ml-8 self-start rounded-md border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand-soft transition hover:bg-brand/15"
                >
                  Set as ${savingsSuggestion.monthlyAmount}/mo savings goal
                </button>
              ) : null}
              {!action.completed &&
                action.status !== 'skipped' &&
                !String(action.id).startsWith('pending-') && (
                  <button
                    type="button"
                    onClick={() => handleSkip(action.id)}
                    className="ml-8 self-start text-[11px] font-medium text-fg-muted hover:text-fg"
                  >
                    Skip
                  </button>
                )}
              {action.status === 'skipped' && (
                <p className="ml-8 text-[11px] text-fg-subtle">Skipped</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ActionChecklist

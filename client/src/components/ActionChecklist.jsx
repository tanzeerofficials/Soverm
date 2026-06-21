/*
 * ACTION CHECKLIST
 *
 * Displays actionable todos from an AI insight with
 * optimistic checkbox toggling synced to the server.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

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

function ActionChecklist({ actions, onUpdate }) {
  const { getToken } = useAuth()
  const [localActions, setLocalActions] = useState(() => normalizeActions(actions))

  useEffect(() => {
    setLocalActions(normalizeActions(actions))
  }, [actions])

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
    <section className="mt-4 rounded-xl border border-[#1E2D45] border-l-4 border-l-[#10B981] bg-[#111827] p-6 transition hover:bg-[#1A2236]">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#10B981]">
        THIS WEEK&apos;S ACTIONS
      </h3>
      <ul className="space-y-1">
        {localActions.map((action) => (
          <li key={action.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-[#1A2236]/60">
            <button
              type="button"
              onClick={() => handleToggle(action.id, action.completed)}
              aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
              aria-pressed={action.completed}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${
                action.completed
                  ? 'border-[#10B981] bg-[#10B981]'
                  : 'border-[#1E2D45] bg-transparent'
              }`}
            >
              {action.completed && (
                <svg
                  className="h-3 w-3 text-white"
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
                action.completed
                  ? 'text-[#6B7280] line-through'
                  : 'text-[#F9FAFB]'
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

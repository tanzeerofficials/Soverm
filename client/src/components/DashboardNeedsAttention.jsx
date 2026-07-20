/*
 * DASHBOARD NEEDS ATTENTION
 *
 * Overview card listing prioritized items: notifications, setup steps,
 * stale sync/insight, and pending insight actions. Each row can be dismissed
 * until the underlying situation changes.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { resolveNotificationTarget } from '../lib/notificationNavigation.js'
import { markNotificationRead } from '../lib/fetchNotifications.js'
import { notificationsQueryKey } from '../lib/queryKeys.js'
import { DASHBOARD_TABS } from './DashboardTabs.jsx'

const TONE_STYLES = {
  ai: 'border-ai/30 bg-ai/10',
  brand: 'border-brand/30 bg-brand/5',
  warning: 'border-warning/30 bg-warning/5',
  danger: 'border-danger/30 bg-danger/5',
}

function DashboardNeedsAttention({
  items,
  getToken,
  onSwitchTab,
  onQuickToolTabChange,
  onDismiss,
  onAllClear,
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => markNotificationRead(getToken, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })

  if (!items.length) {
    if (!onAllClear) {
      return null
    }

    return (
      <section className="rounded-xl border border-brand/25 bg-brand/5 px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-soft">
          You’re clear
        </p>
        <p className="mt-2 text-sm font-semibold text-fg">All caught up</p>
        <p className="mt-1 text-xs text-fg-muted">
          No pending items right now — check back after your next sync or insight.
        </p>
      </section>
    )
  }

  async function handleAction(item) {
    if (item.notification) {
      try {
        await markReadMutation.mutateAsync(item.notificationId)
      } catch {
        // Still navigate — read state is best-effort
      }

      navigate(resolveNotificationTarget(item.notification))
      return
    }

    if (item.href) {
      navigate(item.href)
      return
    }

    if (item.tab === DASHBOARD_TABS.OVERVIEW) {
      onSwitchTab?.(DASHBOARD_TABS.OVERVIEW)
    }

    if (item.tab === DASHBOARD_TABS.INSIGHT) {
      onSwitchTab?.(DASHBOARD_TABS.INSIGHT)
    }

    if (item.tab === DASHBOARD_TABS.TOOLS) {
      onSwitchTab?.(DASHBOARD_TABS.TOOLS)
      if (item.quickToolTab) {
        onQuickToolTabChange?.(item.quickToolTab)
      }
    }

    if (item.scrollTo) {
      window.setTimeout(() => {
        document.getElementById(item.scrollTo)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, item.tab ? 200 : 0)
    }
  }

  return (
    <section
      className="rounded-xl border border-border-default bg-surface p-4 sm:p-5 card-shadow"
      aria-label="Needs your attention"
    >
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-warning">
          Needs your attention
        </p>
        <p className="mt-1 text-xs text-fg-muted">
          {items.length} item{items.length === 1 ? '' : 's'} to review
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`relative rounded-lg border px-3 py-3 sm:px-4 ${TONE_STYLES[item.tone] ?? TONE_STYLES.brand}`}
          >
            <button
              type="button"
              onClick={() => onDismiss?.(item)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border-default/60 bg-surface/90 text-fg-muted shadow-sm backdrop-blur-sm transition hover:border-border-hover hover:bg-surface-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
              aria-label={`Dismiss ${item.title}`}
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between sm:pr-10">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{item.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => handleAction(item)}
                className="shrink-0 self-start rounded-lg border border-border-default bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-border-hover hover:bg-surface"
              >
                {item.actionLabel}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DashboardNeedsAttention

/*
 * PROACTIVE NOTICE BANNER
 *
 * Dashboard callout for unread proactive notifications — v1 delivery surface.
 */

import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  fetchNotifications,
  markNotificationRead,
} from '../lib/fetchNotifications.js'
import { notificationsQueryKey, notificationsUnreadQueryKey } from '../lib/queryKeys.js'
import {
  navigateToNotification,
  notificationActionLabel,
} from '../lib/notificationNavigation.js'

function ProactiveNoticeBanner() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: notificationsUnreadQueryKey,
    queryFn: () => fetchNotifications(getToken, { unreadOnly: true }),
  })

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => markNotificationRead(getToken, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })

  const unread = data?.notifications ?? []
  const latest = unread[0]
  const proactiveEnabled = data?.preferences?.proactiveEnabled ?? true

  if (!latest || !proactiveEnabled) {
    return null
  }

  async function handleOpen() {
    try {
      await markReadMutation.mutateAsync(latest.id)
    } catch {
      // Navigate even if marking read fails
    }

    navigateToNotification(navigate, latest)
  }

  return (
    <section
      className="mb-6 rounded-xl border border-ai/30 bg-ai/10 px-4 py-4 sm:px-5"
      aria-label="Soverm noticed something"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ai-soft">
            Soverm noticed something
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">{latest.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{latest.body}</p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="shrink-0 rounded-lg bg-ai px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          {notificationActionLabel(latest)}
        </button>
      </div>
      {unread.length > 1 && (
        <p className="mt-3 text-xs text-fg-muted">
          +{unread.length - 1} more unread — open the bell icon in the header
        </p>
      )}
    </section>
  )
}

export default ProactiveNoticeBanner

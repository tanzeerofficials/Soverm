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
import { notificationsQueryKey } from '../lib/queryKeys.js'

function ProactiveNoticeBanner() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: notificationsQueryKey,
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
    await markReadMutation.mutateAsync(latest.id)
    navigate(latest.related_data?.link || '/expense-analyzer')
  }

  return (
    <section
      className="mb-6 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-4 sm:px-5"
      aria-label="Soverm noticed something"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#C4B5FD]">
            Soverm noticed something
          </p>
          <p className="mt-1 text-sm font-semibold text-[#F9FAFB]">{latest.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#D1D5DB]">{latest.body}</p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="shrink-0 rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#7C3AED]"
        >
          View details
        </button>
      </div>
      {unread.length > 1 && (
        <p className="mt-3 text-xs text-[#9CA3AF]">
          +{unread.length - 1} more unread — open the bell icon in the header
        </p>
      )}
    </section>
  )
}

export default ProactiveNoticeBanner

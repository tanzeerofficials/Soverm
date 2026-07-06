/*
 * NOTIFICATION BELL
 *
 * Navbar bell with unread badge + dropdown list of proactive alerts.
 */

import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/fetchNotifications.js'
import { notificationsQueryKey } from '../lib/queryKeys.js'

function BellIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  )
}

function NotificationBell() {
  const panelId = useId()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => fetchNotifications(getToken),
    refetchInterval: 60_000,
  })

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0
  const proactiveEnabled = data?.preferences?.proactiveEnabled ?? true

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => markNotificationRead(getToken, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(getToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleNotificationClick(notification) {
    if (!notification.read) {
      await markReadMutation.mutateAsync(notification.id)
    }

    const link = notification.related_data?.link
    setOpen(false)

    if (link) {
      navigate(link)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#1E2D45] bg-[#111827] text-[#9CA3AF] transition hover:bg-[#1A2236] hover:text-white"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8B5CF6] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#1E2D45] bg-[#111827] shadow-2xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-[#1E2D45] px-4 py-3">
            <p className="text-sm font-semibold text-[#F9FAFB]">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-[#8B5CF6] transition hover:text-[#C4B5FD]"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isPending && (
              <p className="px-4 py-6 text-center text-xs text-[#9CA3AF]">Loading…</p>
            )}
            {!isPending && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-[#9CA3AF]">
                No notifications yet — Soverm will flag anything worth a look.
              </p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`flex w-full flex-col gap-1 border-b border-[#1E2D45] px-4 py-3 text-left transition hover:bg-[#1A2236] ${
                  notification.read ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#F9FAFB]">{notification.title}</p>
                  {!notification.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8B5CF6]" />
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[#9CA3AF]">{notification.body}</p>
                <p className="text-[11px] text-[#6B7280]">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </button>
            ))}
          </div>
          {!proactiveEnabled && (
            <p className="border-t border-[#1E2D45] px-4 py-3 text-[11px] leading-relaxed text-[#6B7280]">
              New alerts are paused. Turn them back on in{' '}
              <Link to="/settings" className="text-[#8B5CF6] hover:underline">
                Settings
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell

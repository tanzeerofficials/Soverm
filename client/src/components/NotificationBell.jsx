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
import { notificationsAllQueryKey, notificationsQueryKey } from '../lib/queryKeys.js'
import {
  notificationActionLabel,
  navigateToNotification,
} from '../lib/notificationNavigation.js'

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
    queryKey: notificationsAllQueryKey,
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
      try {
        await markReadMutation.mutateAsync(notification.id)
      } catch {
        // Navigate even if marking read fails
      }
    }

    setOpen(false)
    navigateToNotification(navigate, notification)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-surface text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
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
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ai px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-border-default bg-surface/95 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:w-72"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-default/80 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                className="shrink-0 text-[11px] font-medium text-ai transition hover:text-ai-soft"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-scroll max-h-64 overflow-y-auto overscroll-y-contain sm:max-h-72">
            {isPending && (
              <p className="px-3.5 py-5 text-center text-xs text-fg-muted">Loading…</p>
            )}
            {!isPending && notifications.length === 0 && (
              <p className="px-3.5 py-5 text-center text-xs leading-relaxed text-fg-muted">
                No notifications yet — Soverm will flag anything worth a look.
              </p>
            )}
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className={`flex w-full flex-col gap-0.5 border-b border-border-default/60 px-3.5 py-2.5 text-left transition last:border-b-0 hover:bg-surface-elevated/80 ${
                  notification.read ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium leading-snug text-fg">
                    {notification.title}
                  </p>
                  {!notification.read && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ai" />
                  )}
                </div>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-fg-muted">
                  {notification.body}
                </p>
                <p className="text-[10px] text-fg-subtle">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  {' · '}
                  {notificationActionLabel(notification)}
                </p>
              </button>
            ))}
          </div>
          {!proactiveEnabled && (
            <p className="border-t border-border-default/80 px-3.5 py-2.5 text-[10px] leading-relaxed text-fg-subtle">
              New alerts are paused. Turn them back on in{' '}
              <Link to="/settings" className="text-ai hover:underline">
                Profile
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

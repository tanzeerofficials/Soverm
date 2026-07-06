/*
 * NOTIFICATIONS ROUTES
 *
 * Proactive alerts surfaced on next app open — list, unread count, mark read.
 */

import { Router } from 'express'
import { getAuth, requireAuth } from '@clerk/express'
import {
  countUnreadNotifications,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/proactiveNotifications.js'
import {
  loadProactiveNotificationsEnabled,
  setProactiveNotificationsEnabled,
} from '../utils/notificationPreferences.js'
import { GENERIC_ERROR_MESSAGE } from '../utils/apiErrors.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

router.get('/', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const unreadOnly = req.query.unreadOnly === 'true'
    const [notifications, unreadCount, proactiveEnabled] = await Promise.all([
      listNotificationsForUser(userId, { unreadOnly }),
      countUnreadNotifications(userId),
      loadProactiveNotificationsEnabled(userId),
    ])

    res.json({
      notifications,
      unreadCount,
      preferences: { proactiveEnabled },
    })
  } catch (err) {
    reportServerError('to list notifications', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.get('/unread-count', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const unreadCount = await countUnreadNotifications(userId)
    res.json({ unreadCount })
  } catch (err) {
    reportServerError('to count unread notifications', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/preferences', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    if (typeof req.body?.proactiveEnabled !== 'boolean') {
      return res.status(400).json({ error: 'proactiveEnabled must be a boolean' })
    }

    const proactiveEnabled = await setProactiveNotificationsEnabled(
      userId,
      req.body.proactiveEnabled
    )

    res.json({ preferences: { proactiveEnabled } })
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' })
    }

    reportServerError('to update notification preferences', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/read-all', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    await markAllNotificationsRead(userId)
    res.json({ success: true })
  } catch (err) {
    reportServerError('to mark all notifications read', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

router.patch('/:notificationId/read', async (req, res) => {
  const { userId } = getAuth(req)

  try {
    const updated = await markNotificationRead(userId, req.params.notificationId)

    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    res.json({ success: true })
  } catch (err) {
    reportServerError('to mark notification read', err, { userId, req })
    res.status(500).json({ error: GENERIC_ERROR_MESSAGE })
  }
})

export default router

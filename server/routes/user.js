/*
 * USER ROUTES
 *
 * Account-level actions: permanent deletion of the user and all stored data.
 */

import { Router } from 'express'
import { clerkClient, getAuth, requireAuth } from '@clerk/express'
import { deleteAllUserData } from '../utils/deleteUserData.js'
import { invalidateChatFinancialSnapshot } from '../utils/chatFinancialSnapshotCache.js'
import { reportServerError } from '../utils/sentry.js'

const router = Router()

router.use(requireAuth())

/*
 * DELETE /api/user
 *
 * Permanently deletes the signed-in user's app data and Clerk account.
 */
router.delete('/', async (req, res) => {
  const { userId } = getAuth(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await deleteAllUserData(userId)
    invalidateChatFinancialSnapshot(userId)
    await clerkClient.users.deleteUser(userId)

    res.json({ success: true })
  } catch (err) {
    reportServerError('to delete user account', err, { userId, req })
    res.status(500).json({ error: 'Failed to delete account. Please try again.' })
  }
})

export default router

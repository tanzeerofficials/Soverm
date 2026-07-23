/*
 * ANALYTICS PAGE VIEW + IDENTITY
 *
 * Sends a page_view event when the user navigates to landing,
 * dashboard, or history. Must render inside BrowserRouter AND
 * ClerkProvider (it reads the signed-in user).
 *
 * Also owns funnel step 1: on the first authenticated session of a
 * freshly created account (created within the last day), it identifies
 * the pseudonymous Clerk id with PostHog and fires
 * funnel_signup_completed exactly once per user per browser.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import {
  identifyUser,
  trackFunnelSignupCompleted,
  trackPageView,
} from '../lib/analytics.js'

const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000

function AnalyticsPageView() {
  const { pathname } = useLocation()
  const { isSignedIn, user } = useUser()

  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      return
    }

    identifyUser(user.id)

    const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : null
    if (createdAt && Date.now() - createdAt <= NEW_ACCOUNT_WINDOW_MS) {
      trackFunnelSignupCompleted(user.id)
    }
  }, [isSignedIn, user?.id, user?.createdAt])

  return null
}

export default AnalyticsPageView

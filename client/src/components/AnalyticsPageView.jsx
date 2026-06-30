/*
 * ANALYTICS PAGE VIEW
 *
 * Sends a page_view event when the user navigates to landing,
 * dashboard, or history. Must render inside BrowserRouter.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../lib/analytics.js'

function AnalyticsPageView() {
  const { pathname } = useLocation()

  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  return null
}

export default AnalyticsPageView

/*
 * PAGE TRANSITION LAYOUT
 *
 * Wraps every route in a subtle enter animation when the URL path changes.
 * Uses pathname as a React key so navigating between pages remounts the
 * wrapper and retriggers the CSS animation.
 *
 * Query-only changes (e.g. /dashboard?chat=open) share the same pathname,
 * so they won't replay the transition.
 */

import { Outlet, useLocation } from 'react-router-dom'

function PageTransitionLayout() {
  const { pathname } = useLocation()

  return (
    <div key={pathname} className="page-transition">
      <Outlet />
    </div>
  )
}

export default PageTransitionLayout

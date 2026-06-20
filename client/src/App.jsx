/*
 * APP ROUTER FILE
 *
 * This file decides which page to show based on the URL path.
 * Example:
 * - "/" -> LandingPage
 * - "/dashboard" -> DashboardPage (only if logged in)
 * - unknown path -> NotFoundPage
 */

import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

/*
 * App
 *
 * What it does:
 * - Sets up all app routes and login guards.
 *
 * Why we need login guards on /dashboard:
 * - We do not want strangers seeing a private dashboard page.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <>
            <SignedIn>
              <DashboardPage />
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      />
      <Route
        path="/history"
        element={
          <>
            <SignedIn>
              <HistoryPage />
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App

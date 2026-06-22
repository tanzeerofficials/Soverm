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
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <AppLoadingScreen message="Signing you out…" />
        <Navigate to="/" replace />
      </SignedOut>
    </>
  )
}

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
    <div className="min-h-screen bg-[#0A0F1C]">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App

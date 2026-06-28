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
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function PrivateRoutes() {
  return (
    <>
      <SignedIn>
        <Outlet />
      </SignedIn>
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
 * PrivateRoutes wraps /dashboard and /history so only signed-in users
 * can reach them — including /dashboard?chat=open from the navbar.
 */
function App() {
  return (
    <div className="min-h-screen bg-[#0A0F1C]">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<PrivateRoutes />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App

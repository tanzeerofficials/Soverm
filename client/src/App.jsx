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
import Footer from './components/Footer.jsx'
import AnalyticsPageView from './components/AnalyticsPageView.jsx'
import PageTransitionLayout from './components/PageTransitionLayout.jsx'
import { AskSovermProvider } from './context/AskSovermContext.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import ExpenseAnalyzerPage from './pages/ExpenseAnalyzerPage.jsx'
import WeeklyReviewPage from './pages/WeeklyReviewPage.jsx'
import MonthConditionPage from './pages/MonthConditionPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrivacyPage from './pages/PrivacyPage.jsx'
import TermsPage from './pages/TermsPage.jsx'

function PrivateRoutes() {
  return (
    <>
      <SignedIn>
        <AskSovermProvider>
          <Outlet />
        </AskSovermProvider>
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
 * PrivateRoutes wraps authenticated pages so only signed-in users
 * can reach them. AskSovermProvider mounts the global chat modal.
 */
function App() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-app">
      <div className="flex-1">
        <AnalyticsPageView />
        <Routes>
          <Route element={<PageTransitionLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route element={<PrivateRoutes />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/weekly-review" element={<WeeklyReviewPage />} />
              <Route path="/month-condition" element={<MonthConditionPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/expense-analyzer" element={<ExpenseAnalyzerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </div>
      <Footer />
    </div>
  )
}

export default App

/*
 * REACT ENTRY FILE (main.jsx)
 *
 * This is where the React app starts.
 * Think of it like pressing the power button on the frontend.
 *
 * It wraps App with important providers:
 * - ClerkProvider -> login system
 * - QueryClientProvider -> server data caching (for future API calls)
 * - BrowserRouter -> lets us use page URLs like /dashboard
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkLoaded, ClerkLoading, ClerkProvider } from '@clerk/clerk-react'
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AppLoadingScreen from './components/AppLoadingScreen.jsx'
import { PlaidLinkProvider } from './context/PlaidLinkContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { initAnalytics } from './lib/analytics.js'
import { initSentry, Sentry, captureClientError } from './lib/sentry.js'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const key = Array.isArray(query.queryKey) ? query.queryKey[0] : 'query'
      captureClientError(error, { label: `query:${key}` })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      captureClientError(error, { label: 'mutation' })
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

// VITE_ prefix means this value comes from client/.env and is safe for frontend use.
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

initAnalytics()
const sentryEnabled = initSentry()
if (import.meta.env.DEV) {
  console.info(
    sentryEnabled
      ? '[Sentry] enabled'
      : '[Sentry] disabled — add VITE_SENTRY_DSN to client/.env (not server SENTRY_DSN), then restart Vite'
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A0F1C] px-6 text-center text-sm text-[#9CA3AF]">
          Something went wrong. Please refresh the page.
        </div>
      }
    >
      <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkLoading>
        <AppLoadingScreen />
      </ClerkLoading>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <BrowserRouter>
              <PlaidLinkProvider>
                <App />
              </PlaidLinkProvider>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

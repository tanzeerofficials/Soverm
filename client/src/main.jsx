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
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { PlaidLinkProvider } from './context/PlaidLinkContext.jsx'

const queryClient = new QueryClient()

// VITE_ prefix means this value comes from client/.env and is safe for frontend use.
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PlaidLinkProvider>
            <App />
          </PlaidLinkProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
)

/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Sovrn — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useState } from 'react'
import { SignOutButton, useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router-dom'
import ConnectBankButton from '../components/ConnectBankButton.jsx'
import SyncTransactionsButton from '../components/SyncTransactionsButton'
import GenerateInsightButton from '../components/GenerateInsightButton'
import InsightCard from '../components/InsightCard'
import ActionChecklist from '../components/ActionChecklist'
import SecurityNote from '../components/SecurityNote'
import { useToast, Toast } from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { dashboardQueryKey } from '../lib/queryKeys.js'
import { syncTransactions } from '../lib/syncTransactions.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

function getDisplayBalance(account) {
  if (account.displayBalance != null) {
    return Number(account.displayBalance) || 0
  }
  if (isCreditAccount(account)) {
    return Number(account.balance_current) || 0
  }
  if (account.balance_available != null) {
    return Number(account.balance_available) || 0
  }
  return Number(account.balance_current) || 0
}

function isBalanceWarning(account) {
  const balance = getDisplayBalance(account)
  if (isCreditAccount(account)) {
    return balance > 0
  }
  return balance < 0
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
]

const RANGE_LABELS = {
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  '3m': 'in the last 3 months',
  '1y': 'in the last year',
}

function DashboardPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()

  const [insightError, setInsightError] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [selectedRange, setSelectedRange] = useState('30d')
  const { toast, showToast } = useToast()
  const [accountToDelete, setAccountToDelete] = useState(null)

  const {
    data: dashboardData,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', selectedRange],
    queryFn: async () => {
      const token = await getToken()
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/dashboard/summary?range=${selectedRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        throw new Error(`Dashboard fetch failed: ${res.status}`)
      }
      return res.json()
    },
    refetchInterval: 60_000,
  })

  useEffect(() => {
    async function backgroundSync() {
      try {
        await syncTransactions(getToken)
      } catch (err) {
        console.error('Background sync failed:', err.message)
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    }

    backgroundSync()
  }, [])

  const showSkeleton = isPending && dashboardData === undefined
  const showFailedState = isError && dashboardData === undefined && !isPending

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-[#F9FAFB]">
      {/* Navbar */}
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#1E2D45] bg-[#0A0F1C]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]">
            Soverm
          </span>

          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-[#9CA3AF] sm:inline">{firstName}</span>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
              aria-hidden="true"
            >
              {initials}
            </div>
            <Link
              to="/history"
              className="mr-2 text-sm text-[#9CA3AF] transition hover:text-white sm:mr-3"
            >
              View History
            </Link>
            <SignOutButton>
              <button
                type="button"
                className="rounded-lg border border-[#1E2D45] bg-[#111827] px-3 py-1.5 text-xs font-medium text-[#F9FAFB] transition hover:bg-[#1A2236] sm:px-4 sm:text-sm"
              >
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        {isError && isFetching && dashboardData && (
          <p className="mb-4 text-center text-sm text-[#9CA3AF]" role="status">
            Couldn&apos;t refresh — retrying...
          </p>
        )}

        {showSkeleton ? (
          <>
            <section className="text-center">
              <div
                className="mx-auto h-4 w-32 animate-pulse rounded bg-[#1A2236]"
                aria-hidden="true"
              />
              <div
                className="mx-auto mt-3 h-16 w-64 animate-pulse rounded bg-[#1A2236]"
                aria-hidden="true"
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                <div
                  className="h-4 w-40 animate-pulse rounded bg-[#1A2236]"
                  aria-hidden="true"
                />
                <div
                  className="h-4 w-40 animate-pulse rounded bg-[#1A2236]"
                  aria-hidden="true"
                />
              </div>
            </section>

            <section className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <div
                className="h-12 w-36 animate-pulse rounded-lg bg-[#1A2236]"
                aria-hidden="true"
              />
              <div
                className="h-12 w-36 animate-pulse rounded-lg bg-[#1A2236]"
                aria-hidden="true"
              />
              <div
                className="h-12 w-36 animate-pulse rounded-lg bg-[#1A2236]"
                aria-hidden="true"
              />
            </section>

            <section className="mt-12">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-xl bg-[#1A2236]"
                    aria-hidden="true"
                  />
                ))}
              </div>
            </section>
          </>
        ) : showFailedState ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-[#EF4444]" role="alert">
              Couldn&apos;t load your dashboard. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              Try again
            </button>
          </div>
        ) : dashboardData ? (
          <>
            {/* Hero */}
            <section className="text-center">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#9CA3AF]">
                Total Balance
              </p>
              <p className="mt-3 font-mono text-5xl font-light tracking-tight text-[#F9FAFB] sm:text-6xl md:text-7xl">
                {formatCurrency(dashboardData?.totalBalance ?? 0)}
              </p>
              {dashboardData?.lastSyncedAt && (
                <>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
                    <span className="text-emerald-500" aria-hidden="true">
                      ●
                    </span>
                    Last synced{' '}
                    {formatDistanceToNow(new Date(dashboardData.lastSyncedAt))} ago
                  </p>
                  <p className="mt-1 text-center text-xs text-[#6B7280]">
                    Recent transactions may take a few minutes to appear
                  </p>
                </>
              )}
              <div className="mt-5 mb-2 flex justify-center gap-2">
                {RANGE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedRange(value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedRange === value
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-[#1A2236] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                <span className="text-sm text-[#10B981]">
                  ↑ {formatCurrency(dashboardData?.income ?? 0)} income{' '}
                  {RANGE_LABELS[selectedRange]}
                </span>
                <span className="text-sm text-[#EF4444]">
                  ↓ {formatCurrency(dashboardData?.spent ?? 0)} spent{' '}
                  {RANGE_LABELS[selectedRange]}
                </span>
              </div>
            </section>

            <div className="mx-auto mt-8 max-w-xl">
              <SecurityNote />
            </div>

            {/* Action row */}
            <section className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <ConnectBankButton className="w-full" />
              </div>
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <SyncTransactionsButton className="w-full" showToast={showToast} />
              </div>
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <GenerateInsightButton
                  className="w-full"
                  showCard={false}
                  showToast={showToast}
                  onError={setInsightError}
                  onLoadingChange={setInsightLoading}
                />
              </div>
            </section>

            {/* Accounts */}
            <section className="mt-12">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                Your Accounts
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(dashboardData?.accounts ?? []).map((account) => {
                  const balanceIsWarning = isBalanceWarning(account)
                  return (
                    <article
                      key={account.id}
                      className="relative rounded-xl border border-[#1E2D45] bg-[#111827] p-5 transition hover:border-[#10B981]/40 hover:bg-[#1A2236]"
                    >
                      <button
                        type="button"
                        onClick={() => setAccountToDelete(account)}
                        className="absolute right-3 top-3 text-xs text-[#9CA3AF] transition hover:text-red-400"
                        aria-label={`Disconnect ${account.account_name}`}
                      >
                        ×
                      </button>
                      <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">
                        {account.bank_name}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#F9FAFB]">
                        {account.account_name}
                      </p>
                      <span className="mt-2 inline-block rounded-full border border-[#1E2D45] bg-[#1A2236] px-2.5 py-0.5 text-xs capitalize text-[#9CA3AF]">
                        {account.account_type}
                      </span>
                      <p
                        className={`mt-4 font-mono text-2xl font-semibold ${
                          balanceIsWarning ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        {formatCurrency(getDisplayBalance(account))}
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* AI Insight */}
            <section className="mt-12">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9CA3AF]">
                  Soverm Insight
                </h2>
                <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" aria-hidden="true" />
              </div>

              {insightError && (
                <p className="mb-4 text-sm text-[#EF4444]" role="alert">
                  {insightError}
                </p>
              )}

              {insightLoading ? (
                <div className="rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
                  <p className="text-sm text-[#9CA3AF]">Analyzing your finances...</p>
                </div>
              ) : (
                <>
                  <InsightCard insight={dashboardData?.latestInsight} />
                  <ActionChecklist
                    actions={dashboardData?.latestInsight?.actions || []}
                  />
                </>
              )}
            </section>
          </>
        ) : null}
      </main>
      <Toast toast={toast} />
      <ConfirmModal
        isOpen={!!accountToDelete}
        title="Disconnect this account?"
        message={`This will stop syncing "${accountToDelete?.account_name}". Your transaction history will be kept.`}
        confirmLabel="Disconnect"
        onCancel={() => setAccountToDelete(null)}
        onConfirm={async () => {
          if (!accountToDelete) return

          const accountId = accountToDelete.id
          const accountName = accountToDelete.account_name

          try {
            const token = await getToken()
            const response = await fetch(
              `${import.meta.env.VITE_API_URL}/api/plaid/accounts/${accountId}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            )

            if (!response.ok) {
              const data = await response.json()
              throw new Error(data.error || 'Failed to disconnect account')
            }

            setAccountToDelete(null)
            showToast(`"${accountName}" disconnected`, 'success')
            await queryClient.invalidateQueries({ queryKey: dashboardQueryKey })
          } catch (err) {
            console.error('Failed to disconnect account:', err.message)
            showToast('Failed to disconnect account — please try again', 'error')
          }
        }}
      />
    </div>
  )
}

export default DashboardPage

/*
 * DASHBOARD PAGE
 *
 * Premium home screen for Sovrn — total balance hero, account cards,
 * action buttons, and AI-generated financial insight.
 */

import { useEffect, useState } from 'react'
import { SignOutButton, useAuth, useUser } from '@clerk/clerk-react'
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

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function isCreditAccount(account) {
  return account.account_type?.toLowerCase().includes('credit') ?? false
}

function isBalanceWarning(account) {
  const balance = Number(account.balance_current) || 0
  if (isCreditAccount(account)) {
    return balance > 0
  }
  return balance < 0
}

function DashboardPage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [insightError, setInsightError] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const { toast, showToast } = useToast()
  const [accountToDelete, setAccountToDelete] = useState(null)

  async function fetchDashboardData() {
    try {
      const token = await getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await response.json()
      console.log('Dashboard summary response:', data)
      console.log('latestInsight.actions:', data?.latestInsight?.actions)
      if (response.ok) {
        setDashboardData(data)
      } else {
        console.error('Dashboard summary request failed:', data.error || response.status)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard summary:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [getToken])

  function handleInsightGenerated(insightObject) {
    setInsightError(null)
    setDashboardData((prev) => ({
      ...(prev ?? {}),
      latestInsight: {
        ...insightObject,
        created_at: new Date().toISOString(),
      },
    }))
  }

  function calculateTotalBalance(accounts) {
    return accounts.reduce((total, account) => {
      const balance = Number(account.balance_current) || 0
      if (isCreditAccount(account)) {
        return total - balance
      }
      return total + balance
    }, 0)
  }

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
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-sm text-[#9CA3AF]">Loading your finances...</p>
          </div>
        ) : (
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
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
                  <span className="text-emerald-500" aria-hidden="true">
                    ●
                  </span>
                  Last synced{' '}
                  {formatDistanceToNow(new Date(dashboardData.lastSyncedAt))} ago
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                <span className="text-sm text-[#10B981]">
                  ↑ {formatCurrency(dashboardData?.income ?? 0)} income this period
                </span>
                <span className="text-sm text-[#EF4444]">
                  ↓ {formatCurrency(dashboardData?.spent ?? 0)} spent this period
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
                <SyncTransactionsButton
                  className="w-full"
                  showToast={showToast}
                  onSyncComplete={fetchDashboardData}
                />
              </div>
              <div className="w-full sm:max-w-[200px] sm:flex-1">
                <GenerateInsightButton
                  className="w-full"
                  showCard={false}
                  showToast={showToast}
                  onSyncComplete={fetchDashboardData}
                  onInsightGenerated={handleInsightGenerated}
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
              <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                {(dashboardData?.accounts ?? []).map((account) => {
                  const balanceIsWarning = isBalanceWarning(account)
                  return (
                    <article
                      key={account.id}
                      className="relative min-w-[240px] flex-shrink-0 rounded-xl border border-[#1E2D45] bg-[#111827] p-5 transition hover:border-[#10B981]/40 hover:bg-[#1A2236]"
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
                        {formatCurrency(account.balance_current)}
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
        )}
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

            setDashboardData((prev) => {
              const accounts = (prev?.accounts ?? []).filter(
                (account) => account.id !== accountId
              )
              return {
                ...prev,
                accounts,
                totalBalance: calculateTotalBalance(accounts),
              }
            })
            setAccountToDelete(null)
            showToast(`"${accountName}" disconnected`, 'success')
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

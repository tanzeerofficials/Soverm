/*
 * FIRST CONNECT CELEBRATION
 *
 * ICP onboarding after first bank link (T2.8):
 * celebrate → confirm payday → optional buffer goal → first what's left.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createTracker, fetchTrackers } from '../lib/fetchTrackers.js'
import { fetchPayday, savePayday } from '../lib/fetchPayday.js'
import { formatPayCadence } from '../lib/payCadenceLabels.js'
import { PAY_CADENCE_OPTIONS } from '../lib/payCadenceLabels.js'

const CADENCE_OPTIONS = PAY_CADENCE_OPTIONS

function formatCurrency(amount) {
  if (amount == null) {
    return '—'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function FirstConnectCelebration({
  isOpen,
  accountsConnected = 1,
  syncedAdded = 0,
  getToken,
  isPro = false,
  onClose,
  onGenerateInsight,
  onGoalCreated,
  onPaydaySaved,
}) {
  const [step, setStep] = useState('celebrate')
  const [payCadence, setPayCadence] = useState('biweekly')
  const [nextPaydayOn, setNextPaydayOn] = useState('')
  const [paydayHint, setPaydayHint] = useState(null)
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [whatsLeft, setWhatsLeft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setStep('celebrate')
      setPayCadence('biweekly')
      setNextPaydayOn('')
      setPaydayHint(null)
      setMonthlyAmount('')
      setWhatsLeft(null)
      setError(null)
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !getToken || step !== 'payday') {
      return
    }

    let cancelled = false
    fetchPayday(getToken)
      .then((data) => {
        if (cancelled) {
          return
        }
        if (data?.payday?.configured) {
          setPayCadence(data.payday.payCadence)
          setNextPaydayOn(data.payday.nextPaydayOn ?? '')
          setPaydayHint(null)
          return
        }
        if (data?.suggestion) {
          setPayCadence(data.suggestion.payCadence)
          setNextPaydayOn(data.suggestion.nextPaydayOn ?? '')
          setPaydayHint(data.suggestion)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isOpen, getToken, step])

  if (!isOpen) {
    return null
  }

  async function refreshWhatsLeft() {
    if (!getToken) {
      return null
    }
    const snapshot = await fetchTrackers(getToken)
    const left = snapshot?.whatsLeftUntilPayday ?? null
    setWhatsLeft(left)
    return left
  }

  async function handleSavePayday(event) {
    event.preventDefault()
    if (!nextPaydayOn || !payCadence) {
      setError('Pick a pay cadence and next payday date')
      return
    }
    if (!getToken) {
      setStep('goal')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await savePayday(getToken, { payCadence, nextPaydayOn })
      onPaydaySaved?.()
      await refreshWhatsLeft()
      setStep(isPro ? 'goal' : 'whatsLeft')
    } catch (err) {
      setError(err.message || 'Couldn’t save payday')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBuffer(event) {
    event.preventDefault()
    const amount = Number(monthlyAmount)
    if (!Number.isFinite(amount) || amount < 1) {
      setError('Enter a monthly buffer of at least $1, or skip')
      return
    }

    if (!getToken) {
      setStep('whatsLeft')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createTracker(getToken, {
        trackType: 'saving',
        purposeType: 'future',
        monthlyAmount: amount,
        name: 'Cash buffer',
      })
      onGoalCreated?.()
      await refreshWhatsLeft()
      setStep('whatsLeft')
    } catch (err) {
      setError(err.message || 'Couldn’t create that buffer goal')
    } finally {
      setSaving(false)
    }
  }

  async function goToWhatsLeft() {
    setError(null)
    setSaving(true)
    try {
      await refreshWhatsLeft()
    } catch {
      // still show the step — amount may be unavailable
    } finally {
      setSaving(false)
      setStep('whatsLeft')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-connect-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close celebration"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-default bg-surface shadow-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="relative p-6 sm:p-8">
          {step === 'celebrate' && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/35 bg-brand/10">
                <svg
                  className="h-7 w-7 text-brand-soft"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2 id="first-connect-title" className="mt-5 text-center text-2xl font-bold text-fg">
                You&apos;re connected!
              </h2>
              <p className="mt-2 text-center text-sm leading-relaxed text-fg-muted">
                {accountsConnected === 1
                  ? 'Your first account is linked and synced.'
                  : `${accountsConnected} accounts are linked and synced.`}
                {syncedAdded > 0
                  ? ` Soverm pulled in ${syncedAdded} transaction${syncedAdded === 1 ? '' : 's'}.`
                  : ''}{' '}
                Next: confirm payday so we can show what&apos;s left.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setStep('payday')}
                  className="min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft"
                >
                  Confirm payday
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-xl border border-border-default px-4 py-3 text-sm font-medium text-fg-muted transition hover:bg-surface-elevated hover:text-fg"
                >
                  Skip for now
                </button>
                <p className="text-center text-[11px] text-fg-subtle">
                  What&apos;s left won&apos;t work until payday is set.
                </p>
              </div>
            </>
          )}

          {step === 'payday' && (
            <form onSubmit={handleSavePayday}>
              <h2 id="first-connect-title" className="text-center text-xl font-bold text-fg">
                When do you get paid?
              </h2>
              <p className="mt-2 text-center text-sm text-fg-muted">
                Soverm uses this to show what&apos;s left until payday after known bills.
              </p>

              {paydayHint && (
                <p className="mt-4 rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs leading-relaxed text-ai-soft">
                  We guessed {formatPayCadence(paydayHint.payCadence) || paydayHint.payCadence} pay
                  from your deposits
                  {paydayHint.confidence === 'high'
                    ? ' (strong match)'
                    : paydayHint.confidence === 'medium'
                      ? ' (likely)'
                      : ''}
                  . Confirm or edit below.
                </p>
              )}

              <div className="mt-5 grid gap-3">
                <label className="block text-left">
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    Pay cadence
                  </span>
                  <select
                    value={payCadence}
                    onChange={(event) => setPayCadence(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 text-sm text-fg"
                  >
                    {CADENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-left">
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                    Next payday
                  </span>
                  <input
                    type="date"
                    value={nextPaydayOn}
                    onChange={(event) => setNextPaydayOn(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 text-sm text-fg"
                  />
                </label>
              </div>

              {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={saving || !nextPaydayOn}
                  className="min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save payday'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('celebrate')}
                  className="text-sm text-fg-muted hover:text-fg"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {step === 'goal' && (
            <form onSubmit={handleSaveBuffer}>
              <h2 id="first-connect-title" className="text-center text-xl font-bold text-fg">
                Optional: cash buffer
              </h2>
              <p className="mt-2 text-center text-sm text-fg-muted">
                A small monthly cushion goal — skip if you just want what&apos;s left for now.
              </p>

              <label className="mt-5 block text-left text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Monthly buffer amount
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={monthlyAmount}
                  onChange={(event) => setMonthlyAmount(event.target.value)}
                  placeholder="100"
                  className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 font-mono text-sm text-fg"
                />
              </label>

              {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save buffer & continue'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={goToWhatsLeft}
                  className="min-h-11 w-full rounded-xl bg-ai/15 px-4 py-3 text-sm font-semibold text-ai-soft ring-1 ring-ai/35 transition hover:bg-ai/25 disabled:opacity-60"
                >
                  Skip — show what&apos;s left
                </button>
                <button
                  type="button"
                  onClick={() => setStep('payday')}
                  className="text-sm text-fg-muted hover:text-fg"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {step === 'whatsLeft' && (
            <>
              <h2 id="first-connect-title" className="text-center text-xl font-bold text-fg">
                What&apos;s left until payday
              </h2>
              {whatsLeft?.configured ? (
                <>
                  <p className="mt-4 text-center font-mono text-4xl font-bold tabular-nums text-brand-soft">
                    {formatCurrency(whatsLeft.amount)}
                  </p>
                  <p className="mt-2 text-center text-sm text-fg-muted">
                    {whatsLeft.daysUntilPayday === 0
                      ? 'Payday is today'
                      : `${whatsLeft.daysUntilPayday} day${whatsLeft.daysUntilPayday === 1 ? '' : 's'} until ${whatsLeft.nextPaydayOn}`}
                    {whatsLeft.billsUntilPaydayTotal > 0
                      ? ` · ${formatCurrency(whatsLeft.billsUntilPaydayTotal)} in known bills`
                      : ' · no known bills before payday'}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-center text-sm text-fg-muted">
                  Payday is saved. Open the dashboard to see what&apos;s left once balances finish
                  refreshing.
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/weekly-review"
                  onClick={onClose}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft"
                >
                  Check your week
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 w-full rounded-xl bg-ai/15 px-4 py-3 text-sm font-semibold text-ai-soft ring-1 ring-ai/35 transition hover:bg-ai/25"
                >
                  Done — go to dashboard
                </button>
                <button
                  type="button"
                  onClick={onGenerateInsight}
                  className="text-sm text-fg-muted hover:text-fg"
                >
                  Also generate a one-time insight
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default FirstConnectCelebration

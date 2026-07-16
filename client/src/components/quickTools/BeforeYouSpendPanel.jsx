/*
 * BEFORE YOU SPEND — Quick Tools panel
 *
 * Opt-in affordability check: amount + optional category → fine /
 * blows soft limit / risks rent or payday.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { checkBeforeYouSpend } from '../../lib/fetchBeforeYouSpend.js'

function formatCurrency(amount) {
  if (amount == null) {
    return '—'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function verdictClasses(verdict) {
  if (verdict === 'risks_payday' || verdict === 'risks_rent') {
    return 'border-danger/30 bg-danger/10'
  }
  if (
    verdict === 'blows_category' ||
    verdict === 'caution' ||
    verdict === 'incomplete'
  ) {
    return 'border-warning/30 bg-warning/10'
  }
  return 'border-brand/30 bg-brand/10'
}

function BeforeYouSpendPanel({ getToken, softLimits = [], paydayConfigured = false }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleCheck(event) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive amount')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await checkBeforeYouSpend(getToken, {
        amount: value,
        category: category.trim() || null,
      })
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(err.message || 'Couldn’t check that purchase')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 text-left">
      <p className="text-sm text-fg-muted">
        {softLimits.length > 0
          ? 'Quick check before you buy — against what’s left until payday, and any category spending targets you set. Not a full budget.'
          : 'Quick check before you buy — against what’s left until payday. Not a full budget.'}
      </p>

      {!paydayConfigured && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-fg-muted">
          Confirm payday first so we can judge against what&apos;s left until you&apos;re paid.{' '}
          <Link to="/settings" className="font-semibold text-ai-soft hover:underline">
            Set payday in Profile
          </Link>
        </div>
      )}

      <form onSubmit={handleCheck} className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Amount
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="45"
            className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 font-mono text-sm text-fg"
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Category (optional)
          {softLimits.length > 0 ? (
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 text-sm text-fg"
            >
              <option value="">No category</option>
              {softLimits.map((limit) => (
                <option key={limit.category} value={limit.category}>
                  {limit.category}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="e.g. Food and Drink"
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 text-sm text-fg"
            />
          )}
        </label>
        {softLimits.length === 0 && (
          <p className="text-[11px] text-fg-subtle">
            Optional category targets live under Expenses → Categories.
          </p>
        )}

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check this purchase'}
        </button>
      </form>

      {result && (
        <div className={`rounded-xl border px-4 py-4 ${verdictClasses(result.verdict)}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Verdict
          </p>
          <h3 className="mt-2 text-lg font-semibold text-fg">{result.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{result.detail}</p>
          {result.whatsLeftAfter != null && (
            <p className="mt-2 font-mono text-sm tabular-nums text-fg">
              What’s left after: {formatCurrency(result.whatsLeftAfter)}
            </p>
          )}
          {result.categoryLimit && (
            <p className="mt-1 text-xs text-fg-subtle">
              {result.categoryLimit.category}: {formatCurrency(result.categoryLimit.projectedSpent)}{' '}
              / {formatCurrency(result.categoryLimit.monthlyLimit)} this month after purchase
            </p>
          )}
          {!result.whatsLeftConfigured && (
            <Link
              to="/settings"
              className="mt-3 inline-block text-xs font-semibold text-ai-soft hover:underline"
            >
              Confirm payday for a sharper check →
            </Link>
          )}
          <Link
            to="/weekly-review"
            className="mt-2 block text-xs font-semibold text-ai-soft hover:underline"
          >
            Open Your week →
          </Link>
        </div>
      )}
    </div>
  )
}

export default BeforeYouSpendPanel

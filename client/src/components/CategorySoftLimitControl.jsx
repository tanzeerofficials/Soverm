/*
 * CATEGORY SOFT LIMIT CONTROL
 *
 * Per-category monthly target on Expense Analyzer. Separate from the overall
 * spending cap — shows progress, status, and a small editor.
 */

import { useState } from 'react'
import HowCalculatedDisclosure from './HowCalculatedDisclosure.jsx'
import { formatCurrency } from './expenseAnalyzer/ExpenseAnalyzerDisplay.jsx'
import { DEFAULT_SPENDING_CAP_WARNING_PERCENT } from '../lib/spendingAlertThresholds.js'

export const MAX_CATEGORY_SOFT_LIMITS = 5

export const CATEGORY_SOFT_LIMIT_HELP_ITEMS = [
  'One category, one monthly limit — separate from your overall spending cap.',
  `We warn you in Needs Attention at ${DEFAULT_SPENDING_CAP_WARNING_PERCENT}% of the limit.`,
  `Up to ${MAX_CATEGORY_SOFT_LIMITS} categories. Resets each month.`,
]

function limitStatusBadge(limit) {
  if (limit.isOver) {
    return { text: 'Over limit', tone: 'danger' }
  }
  if (limit.isWarning) {
    return { text: 'Near limit', tone: 'warning' }
  }
  return { text: 'On track', tone: 'neutral' }
}

function badgeClassName(tone) {
  if (tone === 'danger') {
    return 'bg-danger/15 text-danger'
  }
  if (tone === 'warning') {
    return 'bg-warning/15 text-warning'
  }
  return 'bg-brand/15 text-brand-soft'
}

function progressBarClassName(limit) {
  if (limit.isOver) {
    return 'bg-danger'
  }
  if (limit.isWarning) {
    return 'bg-warning'
  }
  return 'bg-brand'
}

export function CategorySoftLimitsIntro({ activeCount = 0 }) {
  return (
    <div className="mb-4 rounded-xl border border-border-default bg-surface px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">Category caps</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            Set a monthly limit for Dining, Shopping, or other categories — separate from your
            overall spending cap.
          </p>
          <HowCalculatedDisclosure title="How it works" items={CATEGORY_SOFT_LIMIT_HELP_ITEMS} />
        </div>
        <p className="shrink-0 rounded-full border border-border-default bg-app/60 px-3 py-1 text-xs text-fg-muted">
          {activeCount} of {MAX_CATEGORY_SOFT_LIMITS}
        </p>
      </div>
    </div>
  )
}

export default function CategorySoftLimitControl({
  category,
  displayName,
  limit = null,
  activeLimitCount = 0,
  spendHint = null,
  onSave,
  onRemove,
  isSaving = false,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [formError, setFormError] = useState('')

  const atMaxLimits = !limit && activeLimitCount >= MAX_CATEGORY_SOFT_LIMITS
  const badge = limit ? limitStatusBadge(limit) : null

  function openEditor() {
    if (atMaxLimits) {
      return
    }

    const suggested =
      limit?.monthlyLimit ??
      (Number.isFinite(spendHint) && spendHint > 0 ? Math.round(spendHint) : '')
    setAmount(suggested === '' ? '' : String(suggested))
    setIsEditing(true)
  }

  function closeEditor() {
    setIsEditing(false)
    setAmount('')
    setFormError('')
  }

  async function handleSave() {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setFormError('Enter a monthly limit of at least $1')
      return
    }

    setFormError('')
    await onSave({ category, monthlyLimit: parsed })
    closeEditor()
  }

  async function handleRemove() {
    if (!limit?.id || !onRemove) {
      return
    }

    setIsRemoving(true)
    try {
      await onRemove(limit.id)
      closeEditor()
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div
      className="mt-3 rounded-lg border border-border-default/80 bg-app/40 px-3 py-3"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-fg">Monthly category cap</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-fg-subtle">
            Set how much you want to spend on {displayName} this month.
          </p>
        </div>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClassName(badge.tone)}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {limit && !isEditing && (
        <div className="mt-3">
          <p className="font-mono text-base font-semibold tabular-nums text-fg">
            {formatCurrency(limit.spentThisMonth)}{' '}
            <span className="text-sm font-normal text-fg-muted">
              of {formatCurrency(limit.monthlyLimit)} this month
            </span>
          </p>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className={`h-full rounded-full ${progressBarClassName(limit)}`}
              style={{ width: `${Math.min(limit.percentUsed, 100)}%` }}
            />
          </div>

          <p className="mt-1.5 text-[11px] text-fg-muted">
            {limit.isOver
              ? `Over by ${formatCurrency(Math.abs(limit.remaining))}`
              : `${formatCurrency(limit.remaining)} left · ${limit.percentUsed}% used`}
            {' · '}
            Warn at {limit.alertWarningPercent ?? DEFAULT_SPENDING_CAP_WARNING_PERCENT}%
          </p>
        </div>
      )}

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] font-medium text-fg-muted" htmlFor={`limit-${category}`}>
            Monthly limit (USD)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`limit-${category}`}
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 400"
              className="w-32 rounded-lg border border-border-default bg-surface px-2.5 py-1.5 font-mono text-sm text-fg"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save limit'}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="text-xs text-fg-muted transition hover:text-fg"
            >
              Cancel
            </button>
          </div>
          {formError && <p className="text-[11px] text-danger">{formError}</p>}
          {!limit && spendHint > 0 && (
            <p className="text-[11px] text-fg-subtle">
              Last 30 days in this category: {formatCurrency(spendHint)} — use as a starting point.
            </p>
          )}
          {limit && onRemove && (
            <button
              type="button"
              disabled={isRemoving || isSaving}
              onClick={handleRemove}
              className="text-xs font-medium text-fg-muted transition hover:text-danger disabled:opacity-60"
            >
              {isRemoving ? 'Removing…' : 'Remove limit'}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={atMaxLimits}
          onClick={openEditor}
          className="mt-3 text-xs font-semibold text-ai-soft transition hover:text-ai hover:underline disabled:cursor-not-allowed disabled:text-fg-subtle disabled:no-underline"
        >
          {limit ? 'Edit limit' : 'Set category limit'}
        </button>
      )}

      {atMaxLimits && (
        <p className="mt-2 text-[11px] text-fg-subtle">
          You’ve reached the maximum of {MAX_CATEGORY_SOFT_LIMITS} category limits. Remove one to
          add another.
        </p>
      )}
    </div>
  )
}

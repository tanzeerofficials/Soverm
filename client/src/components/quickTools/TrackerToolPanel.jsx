/*
 * TRACKER TOOL PANEL
 *
 * Unified Quick tools tab — pick spending cap or savings goal, set a monthly
 * target, and see calendar-month progress with status alerts.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Skeleton from '../Skeleton.jsx'
import HowCalculatedDisclosure from '../HowCalculatedDisclosure.jsx'
import { createTracker, deleteTracker, updateTracker } from '../../lib/fetchTrackers.js'
import { trackerQueryKey } from '../../lib/queryKeys.js'
import { GOAL_PURPOSE_OPTIONS, goalPurposeLabel } from '../../lib/savingsGoalDisplay.js'

const TRACK_MODES = {
  SPENDING: 'spending',
  SAVING: 'saving',
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function statusLabel(status, trackType) {
  if (trackType === 'spending') {
    if (status === 'over') return { text: 'Over limit', tone: 'danger' }
    if (status === 'warning') return { text: 'Approaching limit', tone: 'warning' }
    return { text: 'On track', tone: 'brand' }
  }

  if (status === 'complete') return { text: 'Goal reached', tone: 'brand' }
  if (status === 'on_track') return { text: 'Strong progress', tone: 'brand' }
  return { text: 'Building', tone: 'muted' }
}

function TrackerTypeSelector({ mode, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange(TRACK_MODES.SPENDING)}
        className={`rounded-lg border px-3 py-3 text-left transition ${
          mode === TRACK_MODES.SPENDING
            ? 'border-brand/40 bg-brand/10 ring-1 ring-brand/30'
            : 'border-border-default bg-app/40 hover:border-border-hover'
        }`}
      >
        <p className="text-sm font-semibold text-fg">Track spending</p>
        <p className="mt-1 text-xs text-fg-muted">Set a monthly spending cap</p>
      </button>
      <button
        type="button"
        onClick={() => onChange(TRACK_MODES.SAVING)}
        className={`rounded-lg border px-3 py-3 text-left transition ${
          mode === TRACK_MODES.SAVING
            ? 'border-brand/40 bg-brand/10 ring-1 ring-brand/30'
            : 'border-border-default bg-app/40 hover:border-border-hover'
        }`}
      >
        <p className="text-sm font-semibold text-fg">Track saving</p>
        <p className="mt-1 text-xs text-fg-muted">Set a monthly savings target</p>
      </button>
    </div>
  )
}

function TrackerCreateForm({ mode, snapshot, onCreated, isSaving, errorMessage }) {
  const [name, setName] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [purposeType, setPurposeType] = useState('future')
  const [targetTotal, setTargetTotal] = useState('')

  const suggested =
    mode === TRACK_MODES.SPENDING
      ? snapshot?.suggestedSpendingLimit ?? snapshot?.suggestedBudget ?? 0
      : Math.max(0, (snapshot?.incomeThisMonth ?? 0) - (snapshot?.spentThisMonth ?? 0))

  function handleSubmit(event) {
    event.preventDefault()
    const parsed = Number(monthlyAmount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return
    }

    onCreated({
      trackType: mode,
      name: name.trim() || undefined,
      purposeType: mode === TRACK_MODES.SAVING ? purposeType : undefined,
      monthlyAmount: parsed,
      targetTotal: mode === TRACK_MODES.SAVING && targetTotal ? Number(targetTotal) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-default bg-app/40 p-4 space-y-3">
      <p className="text-sm font-medium text-fg">
        {mode === TRACK_MODES.SPENDING ? 'New spending cap' : 'New savings tracker'}
      </p>
      <p className="text-xs text-fg-muted">
        {mode === TRACK_MODES.SPENDING
          ? 'We compare your connected-account spending this calendar month against this limit.'
          : 'Log how much you have saved toward this goal each month. Bank transfers are not auto-detected yet.'}
      </p>

      {suggested > 0 && (
        <p className="text-xs text-fg-subtle">
          Suggested:{' '}
          <span className="font-mono tabular-nums text-fg-muted">{formatCurrency(suggested)}</span>
        </p>
      )}

      {mode === TRACK_MODES.SAVING && (
        <>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Goal name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pay off credit card"
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2 text-sm text-fg outline-none focus:border-brand/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Purpose</span>
            <select
              value={purposeType}
              onChange={(e) => setPurposeType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2 text-sm text-fg outline-none focus:border-brand/50"
            >
              {GOAL_PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {mode === TRACK_MODES.SPENDING ? 'Monthly spending limit' : 'Save this month'}
        </span>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            placeholder={mode === TRACK_MODES.SPENDING ? '1500' : '300'}
            className="w-full rounded-lg border border-border-default bg-app py-2 pl-7 pr-3 font-mono text-sm tabular-nums text-fg outline-none focus:border-brand/50"
          />
        </div>
      </label>

      {mode === TRACK_MODES.SAVING && (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Total target (optional)
          </span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetTotal}
              onChange={(e) => setTargetTotal(e.target.value)}
              placeholder="1200"
              className="w-full rounded-lg border border-border-default bg-app py-2 pl-7 pr-3 font-mono text-sm tabular-nums text-fg outline-none focus:border-brand/50"
            />
          </div>
        </label>
      )}

      {errorMessage && (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving || !monthlyAmount}
        className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:opacity-60"
      >
        {isSaving ? 'Saving…' : 'Start tracking'}
      </button>
    </form>
  )
}

function TrackerEditForm({ mode, tracker, onSave, onCancel, isSaving, errorMessage }) {
  const [name, setName] = useState(tracker.name ?? '')
  const [monthlyAmount, setMonthlyAmount] = useState(String(tracker.monthlyAmount ?? ''))
  const [purposeType, setPurposeType] = useState(tracker.purposeType ?? 'future')
  const [targetTotal, setTargetTotal] = useState(
    tracker.targetTotal != null ? String(tracker.targetTotal) : ''
  )

  function handleSubmit(event) {
    event.preventDefault()
    const parsedMonthly = Number(monthlyAmount)
    if (!Number.isFinite(parsedMonthly) || parsedMonthly <= 0) {
      return
    }

    const payload = {
      name: name.trim() || undefined,
      monthlyAmount: parsedMonthly,
    }

    if (mode === TRACK_MODES.SAVING) {
      payload.purposeType = purposeType
      payload.targetTotal = targetTotal ? Number(targetTotal) : null
    }

    onSave(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-border-default bg-app/40 p-3">
      {mode === TRACK_MODES.SAVING && (
        <>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Goal name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2 text-sm text-fg outline-none focus:border-brand/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Purpose</span>
            <select
              value={purposeType}
              onChange={(e) => setPurposeType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2 text-sm text-fg outline-none focus:border-brand/50"
            >
              {GOAL_PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {mode === TRACK_MODES.SPENDING ? 'Monthly spending limit' : 'Save this month'}
        </span>
        <div className="relative mt-1.5">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-app py-2 pl-7 pr-3 font-mono text-sm tabular-nums text-fg outline-none focus:border-brand/50"
          />
        </div>
      </label>

      {mode === TRACK_MODES.SAVING && (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Total target (optional)
          </span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted">$</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetTotal}
              onChange={(e) => setTargetTotal(e.target.value)}
              placeholder="Leave blank for none"
              className="w-full rounded-lg border border-border-default bg-app py-2 pl-7 pr-3 font-mono text-sm tabular-nums text-fg outline-none focus:border-brand/50"
            />
          </div>
        </label>
      )}

      {errorMessage && (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSaving || !monthlyAmount}
          className="text-xs font-semibold text-brand-soft hover:underline disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-fg-muted hover:text-fg">
          Cancel
        </button>
      </div>
    </form>
  )
}

function SpendingTrackerCard({ tracker, periodLabel, getToken, onRemove, isRemoving }) {
  const { progress, monthlyAmount, name } = tracker
  const badge = statusLabel(progress.status, 'spending')
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState(null)
  const queryClient = useQueryClient()

  const editMutation = useMutation({
    mutationFn: (payload) => updateTracker(getToken, tracker.id, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(trackerQueryKey, response)
      setIsEditing(false)
      setEditError(null)
    },
    onError: (error) => setEditError(error.message),
  })

  return (
    <article className="rounded-lg border border-border-default bg-app/50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{name}</p>
          <p className="mt-0.5 text-xs text-fg-muted">Spending cap · {periodLabel}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            badge.tone === 'danger'
              ? 'bg-danger/15 text-danger'
              : badge.tone === 'warning'
                ? 'bg-warning/15 text-warning'
                : 'bg-brand/15 text-brand-soft'
          }`}
        >
          {badge.text}
        </span>
      </div>

      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-fg">
        {formatCurrency(progress.spent)}{' '}
        <span className="text-base font-normal text-fg-muted">of {formatCurrency(monthlyAmount)}</span>
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={`h-full rounded-full ${
            progress.isOver ? 'bg-danger' : progress.percentUsed >= 80 ? 'bg-warning' : 'bg-brand'
          }`}
          style={{ width: `${Math.min(progress.percentUsed, 100)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-fg-muted">
        {progress.isOver
          ? `Over by ${formatCurrency(progress.overBy)}`
          : `${formatCurrency(progress.remaining)} left to spend · ${progress.percentUsed}% used`}
      </p>

      {isEditing ? (
        <TrackerEditForm
          mode={TRACK_MODES.SPENDING}
          tracker={tracker}
          onSave={(payload) => editMutation.mutate(payload)}
          onCancel={() => {
            setIsEditing(false)
            setEditError(null)
          }}
          isSaving={editMutation.isPending}
          errorMessage={editError}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-3 text-xs font-medium text-ai-soft transition hover:text-ai hover:underline"
        >
          Edit spending cap
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        className="mt-3 text-xs font-medium text-fg-muted transition hover:text-danger"
      >
        Stop tracking
      </button>
    </article>
  )
}

function SavingTrackerCard({ tracker, periodLabel, getToken, onRemove, isRemoving }) {
  const { progress, monthlyAmount, name, purposeType, targetTotal } = tracker
  const badge = statusLabel(progress.status, 'saving')
  const [isLogging, setIsLogging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState(null)
  const queryClient = useQueryClient()

  const logMutation = useMutation({
    mutationFn: (progressAmount) => updateTracker(getToken, tracker.id, { progressAmount }),
    onSuccess: (response) => {
      queryClient.setQueryData(trackerQueryKey, response)
      setIsLogging(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: (payload) => updateTracker(getToken, tracker.id, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(trackerQueryKey, response)
      setIsEditing(false)
      setEditError(null)
    },
    onError: (error) => setEditError(error.message),
  })

  return (
    <article className="rounded-lg border border-border-default bg-app/50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg">{name}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {goalPurposeLabel(purposeType)} · {periodLabel}
          </p>
        </div>
        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-soft">
          {badge.text}
        </span>
      </div>

      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-fg">
        {formatCurrency(progress.savedThisMonth ?? progress.saved)}{' '}
        <span className="text-base font-normal text-fg-muted">of {formatCurrency(monthlyAmount)} this month</span>
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-ai"
          style={{ width: `${progress.percentOfMonthly}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-fg-muted">
        {progress.percentOfMonthly}% of monthly target
        {targetTotal != null &&
          ` · ${formatCurrency(progress.totalSaved ?? progress.saved)} of ${formatCurrency(targetTotal)} total`}
      </p>
      {progress.paceEstimate > 0 && (
        <p className="mt-1 text-xs text-fg-subtle">
          Income minus spending this month: {formatCurrency(progress.paceEstimate)} (for context only)
        </p>
      )}

      {!isLogging && !isEditing ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => setIsLogging(true)}
            className="text-xs font-medium text-ai-soft transition hover:text-ai hover:underline"
          >
            Update saved this month
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs font-medium text-fg-muted transition hover:text-fg hover:underline"
          >
            Edit goal
          </button>
        </div>
      ) : isLogging ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const parsed = Number(e.target.elements.progressAmount.value)
            if (Number.isFinite(parsed) && parsed >= 0) {
              logMutation.mutate(parsed)
            }
          }}
        >
          <input
            name="progressAmount"
            type="number"
            min="0"
            step="1"
            defaultValue={progress.savedThisMonth ?? progress.saved}
            className="w-28 rounded-md border border-border-default bg-app px-2 py-1 font-mono text-xs tabular-nums text-fg"
          />
          <button type="submit" className="text-xs font-medium text-brand-soft hover:underline">
            Save
          </button>
          <button type="button" onClick={() => setIsLogging(false)} className="text-xs text-fg-muted">
            Cancel
          </button>
        </form>
      ) : (
        <TrackerEditForm
          mode={TRACK_MODES.SAVING}
          tracker={tracker}
          onSave={(payload) => editMutation.mutate(payload)}
          onCancel={() => {
            setIsEditing(false)
            setEditError(null)
          }}
          isSaving={editMutation.isPending}
          errorMessage={editError}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving}
        className="mt-3 block text-xs font-medium text-fg-muted transition hover:text-danger"
      >
        Stop tracking
      </button>
    </article>
  )
}

function TrackerToolPanel({ snapshot, isLoading, loadError, onRetryLoad, getToken }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState(TRACK_MODES.SPENDING)
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState(null)

  const createMutation = useMutation({
    mutationFn: (payload) => createTracker(getToken, payload),
    onSuccess: (response) => {
      queryClient.setQueryData(trackerQueryKey, response)
      setShowCreate(false)
      setCreateError(null)
    },
    onError: (error) => setCreateError(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteTracker(getToken, id),
    onSuccess: (response) => {
      queryClient.setQueryData(trackerQueryKey, response)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-4">
        <p className="text-sm font-medium text-fg">Couldn&apos;t load trackers</p>
        <p className="mt-1 text-sm text-fg-muted">{loadError.message}</p>
        {onRetryLoad && (
          <button
            type="button"
            onClick={onRetryLoad}
            className="mt-3 rounded-lg border border-border-default bg-surface-elevated px-4 py-2 text-sm font-medium text-fg"
          >
            Try again
          </button>
        )}
      </div>
    )
  }

  const trackers = snapshot?.trackers ?? []
  const spendingTracker = snapshot?.spendingTracker
  const savingTrackers = snapshot?.savingTrackers ?? []
  const periodLabel = snapshot?.periodLabel ?? 'This month'
  const hasSpending = Boolean(spendingTracker)
  const canAddSaving = savingTrackers.length < 5

  return (
    <div className="space-y-4">
      {spendingTracker && (
        <SpendingTrackerCard
          tracker={spendingTracker}
          periodLabel={periodLabel}
          getToken={getToken}
          onRemove={() => deleteMutation.mutate(spendingTracker.id)}
          isRemoving={deleteMutation.isPending}
        />
      )}

      {savingTrackers.length > 0 && (
        <ul className="space-y-3">
          {savingTrackers.map((tracker) => (
            <li key={tracker.id}>
              <SavingTrackerCard
                tracker={tracker}
                periodLabel={periodLabel}
                getToken={getToken}
                onRemove={() => deleteMutation.mutate(tracker.id)}
                isRemoving={deleteMutation.isPending}
              />
            </li>
          ))}
        </ul>
      )}

      {trackers.length === 0 && !showCreate && (
        <p className="text-sm text-fg-muted">
          Track a monthly spending cap (e.g. $1,500) or a savings target (e.g. save $300 for debt payoff).
        </p>
      )}

      {!showCreate && (canAddSaving || !hasSpending) && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm font-semibold text-brand-soft transition hover:text-brand hover:underline"
        >
          + Add tracker
        </button>
      )}

      {showCreate && (
        <>
          <TrackerTypeSelector mode={mode} onChange={setMode} />
          <TrackerCreateForm
            mode={mode}
            snapshot={snapshot}
            onCreated={(payload) => createMutation.mutate(payload)}
            isSaving={createMutation.isPending}
            errorMessage={createError}
          />
          <button
            type="button"
            onClick={() => {
              setShowCreate(false)
              setCreateError(null)
            }}
            className="text-sm text-fg-muted hover:text-fg"
          >
            Cancel
          </button>
        </>
      )}

      <HowCalculatedDisclosure
        title="How tracking works"
        items={[
          'Spending trackers compare outflows from connected accounts this calendar month (pending excluded).',
          'Saving trackers use amounts you log each calendar month — progress resets on the 1st.',
          'Your total toward a goal is tracked separately and does not reset monthly.',
          'We do not detect bank transfers automatically yet.',
          'Spending and saving trackers are independent; one does not reduce the other automatically.',
        ]}
      />
    </div>
  )
}

export default TrackerToolPanel

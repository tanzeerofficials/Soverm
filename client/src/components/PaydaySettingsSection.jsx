/*
 * PAYDAY SETTINGS SECTION
 *
 * Lets paycheck-to-paycheck users confirm pay cadence + next payday
 * so Soverm can compute "what's left until payday."
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToastContext } from '../context/ToastContext.jsx'
import { fetchPayday, savePayday } from '../lib/fetchPayday.js'
import { paydayQueryKey, trackerQueryKey } from '../lib/queryKeys.js'
import { formatPayCadence, PAY_CADENCE_OPTIONS } from '../lib/payCadenceLabels.js'

const CADENCE_OPTIONS = PAY_CADENCE_OPTIONS

function PaydaySettingsSection() {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()

  const { data, isLoading } = useQuery({
    queryKey: paydayQueryKey,
    queryFn: () => fetchPayday(getToken),
  })

  const payday = data?.payday
  const suggestion = data?.suggestion

  const [payCadence, setPayCadence] = useState('biweekly')
  const [nextPaydayOn, setNextPaydayOn] = useState('')

  useEffect(() => {
    if (payday?.configured) {
      setPayCadence(payday.payCadence)
      setNextPaydayOn(payday.nextPaydayOn ?? '')
      return
    }
    if (suggestion) {
      setPayCadence(suggestion.payCadence)
      setNextPaydayOn(suggestion.nextPaydayOn ?? '')
    }
  }, [payday, suggestion])

  const saveMutation = useMutation({
    mutationFn: () =>
      savePayday(getToken, {
        payCadence,
        nextPaydayOn,
      }),
    onSuccess: async () => {
      showToast('Payday saved — we’ll use it for what’s left', 'success')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: paydayQueryKey }),
        queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
      ])
    },
    onError: (err) => {
      showToast(err.message || 'Couldn’t save payday', 'error')
    },
  })

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-fg-muted">
        Tell us when you get paid. Soverm uses this to show how much you have left until
        payday after known bills — separate from any monthly spending cap.
      </p>

      {isLoading ? (
        <p className="text-sm text-fg-subtle">Loading payday…</p>
      ) : (
        <>
          {suggestion && !payday?.configured && (
            <p className="rounded-lg border border-ai/30 bg-ai/10 px-3 py-2 text-xs leading-relaxed text-ai-soft">
              We guessed {formatPayCadence(suggestion.payCadence) || suggestion.payCadence} pay from
              your deposits
              {suggestion.confidence === 'high'
                ? ' (strong match)'
                : suggestion.confidence === 'medium'
                  ? ' (likely)'
                  : ''}
              . Confirm or edit below.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-left">
              <span className="text-xs font-medium text-fg-muted">Pay cadence</span>
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
              <span className="text-xs font-medium text-fg-muted">Next payday</span>
              <input
                type="date"
                value={nextPaydayOn}
                onChange={(event) => setNextPaydayOn(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border-default bg-app px-3 py-2.5 text-sm text-fg"
              />
            </label>
          </div>

          {payday?.configured && payday.daysUntilPayday != null && (
            <p className="text-xs text-fg-subtle">
              {payday.daysUntilPayday === 0
                ? 'Payday is today'
                : `${payday.daysUntilPayday} day${payday.daysUntilPayday === 1 ? '' : 's'} until payday`}
              {payday.paydaySource === 'inferred'
                ? ' · guessed from deposits (you can edit anytime)'
                : payday.paydaySource === 'user'
                  ? ' · confirmed by you'
                  : ''}
            </p>
          )}

          <button
            type="button"
            disabled={saveMutation.isPending || !nextPaydayOn || !payCadence}
            onClick={() => saveMutation.mutate()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-soft disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : payday?.configured ? 'Update payday' : 'Save payday'}
          </button>
        </>
      )}
    </div>
  )
}

export default PaydaySettingsSection

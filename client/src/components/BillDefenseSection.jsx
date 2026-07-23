/*
 * BILL / SUBSCRIPTION DEFENSE UI
 *
 * Shows price hikes, new recurrings, trials, and duplicates — with
 * keep / cancel / watch decisions that become closed-loop actions.
 *
 * Important: Cancel does NOT cancel the merchant subscription. It logs
 * the user's intent so Soverm can remind them to cancel it themselves.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { createClosedLoopAction } from '../lib/fetchActions.js'
import { useToastContext } from '../context/ToastContext.jsx'
import { markActivationStep } from '../lib/activationChecklist.js'
import { toUserFacingErrorMessage } from '../lib/userFacingError.js'
import { isDemoSession } from '../lib/demoSession.js'

function toneClasses(tone) {
  if (tone === 'warning') {
    return 'border-warning/30 bg-warning/10'
  }
  return 'border-border-default bg-surface'
}

function findingKey(finding) {
  return `${finding.type}-${finding.merchant}-${finding.otherMerchant ?? ''}`
}

function decisionDescription(decision, finding) {
  const merchant = finding.merchant || 'this subscription'
  if (decision === 'cancel') {
    return `Reminder: cancel ${merchant} yourself`
  }
  if (decision === 'watch') {
    return `Watch ${merchant} one more cycle`
  }
  return `Keep ${merchant}`
}

function loggedDecisionCopy(decision, merchant) {
  const name = merchant || 'this subscription'
  if (decision === 'cancel') {
    return {
      title: 'Reminder set — you cancel it',
      detail: `Soverm can’t cancel ${name} with the company. We’ll remind you to cancel it yourself before the next charge.`,
    }
  }
  if (decision === 'watch') {
    return {
      title: 'Watching one more cycle',
      detail: `We’ll check back on ${name} next week.`,
    }
  }
  return {
    title: 'Marked keep',
    detail: `Got it — keeping ${name} for now.`,
  }
}

/**
 * What this does: renders bill-defense findings and logs keep/cancel/watch
 * as closed-loop actions (same lifecycle as Weekly Review moves).
 * Why: paycheck-to-paycheck users need a clear decision, not just a flag.
 * How it fits: S1–S3 detection + S3 decision flow; reused on Weekly Review,
 * Expense Analyzer Recurring, and (read-only-ish) Month letter.
 */
function BillDefenseSection({
  findings = [],
  weekStartOn = null,
  onAskSoverm,
  showDecisions = true,
  invalidateKeys = [],
  title = 'Bills & subscriptions to review',
  emptyMessage = null,
}) {
  const { getToken, userId } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()
  const [loggedByKey, setLoggedByKey] = useState({})
  const demo = isDemoSession()

  const decisionMutation = useMutation({
    mutationFn: async ({ decision, finding }) =>
      createClosedLoopAction(getToken, {
        description: decisionDescription(decision, finding),
        source: 'weekly',
        status: 'accepted',
        weekStartOn,
        metadata: {
          kind: 'bill_defense',
          decision,
          findingType: finding.type,
          merchant: finding.merchant,
          otherMerchant: finding.otherMerchant ?? null,
          monthlyEquivalent: finding.monthlyEquivalent ?? null,
        },
      }),
    onSuccess: async (_result, variables) => {
      const key = findingKey(variables.finding)
      setLoggedByKey((prev) => ({
        ...prev,
        [key]: variables.decision,
      }))

      const copy = loggedDecisionCopy(variables.decision, variables.finding.merchant)
      showToast(
        variables.decision === 'cancel'
          ? 'Reminder set — cancel it yourself; we’ll nudge you'
          : copy.title,
        'success'
      )
      markActivationStep(userId, 'actionTaken')
      await Promise.all(
        invalidateKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
    onError: (err) => {
      showToast(toUserFacingErrorMessage(err, 'Couldn’t save that decision'), 'error')
    },
  })

  if (!findings.length) {
    if (!emptyMessage) {
      return null
    }
    return (
      <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left card-shadow">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
          {title}
        </p>
        <p className="mt-3 text-sm text-fg-muted">{emptyMessage}</p>
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left card-shadow"
      aria-label={title}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
        {title}
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        Price hikes, new charges, trials, and possible duplicates — decide keep, plan to
        cancel, or watch. We don’t cancel with the merchant for you; “Plan to cancel”
        logs it so we can remind you before the next charge.
      </p>
      <ul className="mt-4 space-y-3">
        {findings.map((finding) => {
          const key = findingKey(finding)
          const loggedDecision = loggedByKey[key]
          const loggedCopy = loggedDecision
            ? loggedDecisionCopy(loggedDecision, finding.merchant)
            : null

          return (
            <li
              key={key}
              className={`rounded-lg border px-3 py-3 ${toneClasses(finding.tone)}`}
            >
              <p className="text-sm font-semibold text-fg">{finding.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{finding.detail}</p>

              {loggedCopy ? (
                <div className="mt-3 space-y-2">
                  <div
                    className="rounded-md border border-brand/25 bg-brand/10 px-2.5 py-2"
                    role="status"
                  >
                    <p className="text-[11px] font-semibold text-brand-soft">
                      {loggedCopy.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
                      {loggedCopy.detail}
                    </p>
                  </div>
                  {onAskSoverm && (
                    <button
                      type="button"
                      onClick={() => onAskSoverm(finding)}
                      className="rounded-md border border-ai/40 bg-ai/10 px-2.5 py-1.5 text-[11px] font-semibold text-ai hover:bg-ai/20"
                    >
                      Ask Soverm
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {showDecisions && (
                    <>
                      <button
                        type="button"
                        disabled={decisionMutation.isPending || demo}
                        title={demo ? 'Sign up to save decisions on your own data' : undefined}
                        onClick={() =>
                          decisionMutation.mutate({ decision: 'keep', finding })
                        }
                        className="rounded-md border border-border-default px-2.5 py-1.5 text-[11px] font-semibold text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        disabled={decisionMutation.isPending || demo}
                        title={demo ? 'Sign up to save decisions on your own data' : undefined}
                        onClick={() =>
                          decisionMutation.mutate({ decision: 'cancel', finding })
                        }
                        className="rounded-md bg-danger/15 px-2.5 py-1.5 text-[11px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Plan to cancel
                      </button>
                      <button
                        type="button"
                        disabled={decisionMutation.isPending || demo}
                        title={demo ? 'Sign up to save decisions on your own data' : undefined}
                        onClick={() =>
                          decisionMutation.mutate({ decision: 'watch', finding })
                        }
                        className="rounded-md bg-warning/15 px-2.5 py-1.5 text-[11px] font-semibold text-warning disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Watch
                      </button>
                    </>
                  )}
                  {onAskSoverm && (
                    <button
                      type="button"
                      onClick={() => onAskSoverm(finding)}
                      className="rounded-md border border-ai/40 bg-ai/10 px-2.5 py-1.5 text-[11px] font-semibold text-ai hover:bg-ai/20"
                    >
                      Ask Soverm
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {showDecisions && (
        <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
          Soverm can’t cancel with the company — we remind you.
        </p>
      )}
    </section>
  )
}

export default BillDefenseSection

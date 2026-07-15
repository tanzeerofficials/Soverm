/*
 * WEEKLY REVIEW PAGE
 *
 * Paycheck-to-paycheck ritual: how you did, runway coach, what's left,
 * one risk, one move — plus inline payday confirm/edit (R4).
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/AppNavbar.jsx'
import BillDefenseSection from '../components/BillDefenseSection.jsx'
import HowCalculatedDisclosure from '../components/HowCalculatedDisclosure.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { useToastContext } from '../context/ToastContext.jsx'
import { useAskSoverm } from '../context/AskSovermContext.jsx'
import { savePayday } from '../lib/fetchPayday.js'
import { createClosedLoopAction, updateActionLifecycle } from '../lib/fetchActions.js'
import { fetchWeeklyReview } from '../lib/fetchWeeklyReview.js'
import { buildCancelKeepWatchPrompt, buildWeeklyReviewSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'
import { markActivationStep } from '../lib/activationChecklist.js'
import { trackWeeklyReviewView } from '../lib/analytics.js'
import { formatActionStatus, formatPayCadence, PAY_CADENCE_OPTIONS } from '../lib/payCadenceLabels.js'
import {
  paydayQueryKey,
  trackerQueryKey,
  weeklyReviewQueryKey,
} from '../lib/queryKeys.js'

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

function toneClasses(tone) {
  if (tone === 'danger' || tone === 'at_risk') {
    return 'border-danger/30 bg-danger/10'
  }
  if (tone === 'warning' || tone === 'tight') {
    return 'border-warning/30 bg-warning/10'
  }
  if (tone === 'brand' || tone === 'fine') {
    return 'border-brand/30 bg-brand/10'
  }
  return 'border-border-default bg-surface'
}

function verdictBadge(verdict) {
  if (verdict === 'at_risk') {
    return 'At risk'
  }
  if (verdict === 'tight') {
    return 'Tight'
  }
  if (verdict === 'fine') {
    return 'Fine'
  }
  return null
}

function WeeklyReviewPage() {
  const { getToken, userId } = useAuth()
  const { openChat } = useAskSoverm()
  const queryClient = useQueryClient()
  const { showToast } = useToastContext()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: weeklyReviewQueryKey,
    queryFn: () => fetchWeeklyReview(getToken),
  })

  useEffect(() => {
    if (!userId || isLoading || isError) {
      return
    }
    markActivationStep(userId, 'weeklyReview')
    trackWeeklyReviewView()
  }, [userId, isLoading, isError])

  const [payCadence, setPayCadence] = useState('biweekly')
  const [nextPaydayOn, setNextPaydayOn] = useState('')
  const [editingPayday, setEditingPayday] = useState(false)

  useEffect(() => {
    if (data?.payday?.configured) {
      setPayCadence(data.payday.payCadence)
      setNextPaydayOn(data.payday.nextPaydayOn ?? '')
      return
    }
    setEditingPayday(true)
  }, [data?.payday])

  const saveMutation = useMutation({
    mutationFn: () =>
      savePayday(getToken, {
        payCadence,
        nextPaydayOn,
      }),
    onSuccess: async () => {
      showToast('Payday updated', 'success')
      setEditingPayday(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: weeklyReviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: paydayQueryKey }),
        queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
      ])
    },
    onError: (err) => {
      showToast(err.message || 'Couldn’t save payday', 'error')
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ mode, followUpId }) => {
      if (mode === 'accept' || mode === 'skip') {
        return createClosedLoopAction(getToken, {
          description: data.move?.detail
            ? `${data.move.title}: ${data.move.detail}`
            : data.move?.title,
          source: 'weekly',
          status: mode === 'accept' ? 'accepted' : 'skipped',
          weekStartOn: data.week?.weekStartIso,
          metadata: {
            moveId: data.move?.id,
            title: data.move?.title,
          },
        })
      }
      if (mode === 'done' || mode === 'still-relevant-skip') {
        return updateActionLifecycle(getToken, followUpId, {
          status: mode === 'done' ? 'done' : 'skipped',
        })
      }
      return null
    },
    onSuccess: async (_result, variables) => {
      if (variables.mode === 'accept') {
        showToast('Action accepted — we’ll check in next week', 'success')
        markActivationStep(userId, 'actionTaken')
      } else if (variables.mode === 'skip') {
        showToast('Skipped for this week', 'success')
      } else if (variables.mode === 'done') {
        showToast('Marked done', 'success')
        markActivationStep(userId, 'actionTaken')
      }
      await queryClient.invalidateQueries({ queryKey: weeklyReviewQueryKey })
    },
    onError: (err) => {
      showToast(err.message || 'Couldn’t update that action', 'error')
    },
  })

  const coach = data?.runwayCoach
  const coachTone = coach?.verdict || 'neutral'

  return (
    <div className="min-h-screen bg-app text-fg">
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <PageHeader
          title="Your week"
          description={
            data?.week?.label
              ? `${data.week.label} · how you did, whether you’ll make it to payday, and one better move`
              : 'How you did, whether you’ll make it to payday, and one better move'
          }
        />

        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-5 py-6 text-center">
            <p className="text-sm text-fg-muted">Couldn’t load your weekly review.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-semibold text-brand-soft hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.sparse && (
              <div className="rounded-xl border border-border-default bg-surface px-4 py-3 text-sm text-fg-muted">
                {data.accountCount === 0
                  ? 'Connect a bank to unlock a full weekly review.'
                  : `Early days (${data.historyDays} day${data.historyDays === 1 ? '' : 's'} of history). We’ll get sharper after a full week of transactions.`}
                {data.accountCount === 0 && (
                  <Link
                    to="/dashboard"
                    className="mt-2 block text-xs font-semibold text-ai-soft hover:underline"
                  >
                    Connect your bank on Dashboard
                  </Link>
                )}
              </div>
            )}

            {/* R1–R3 Runway coach */}
            <section
              className={`rounded-xl border px-5 py-5 text-left ${toneClasses(coachTone)}`}
              aria-labelledby="runway-coach-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                  Will I make it to payday?
                </p>
                {verdictBadge(coach?.verdict) && (
                  <span className="rounded-full border border-border-default bg-app/60 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg">
                    {verdictBadge(coach.verdict)}
                  </span>
                )}
              </div>
              <h2 id="runway-coach-heading" className="mt-2 text-lg font-semibold text-fg">
                {coach?.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{coach?.detail}</p>
              {coach?.verdict && (
                <p className="mt-2 text-xs text-fg-subtle">
                  {coach.verdict === 'fine' &&
                    'Fine = at this week’s pace, bills look covered until payday.'}
                  {coach.verdict === 'tight' &&
                    'Tight = you’ll likely make it, but there’s little room for surprises.'}
                  {coach.verdict === 'at_risk' &&
                    'At risk = this week’s pace or bills may leave you short before payday.'}
                </p>
              )}

              {coach?.pace && (
                <div className="mt-4 rounded-lg border border-border-default/70 bg-app/40 px-3 py-3">
                  <p className="text-xs font-semibold text-fg">This week’s pace</p>
                  <p className="mt-1 text-sm text-fg-muted">{coach.pace.summary}</p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    {formatCurrency(coach.pace.spentThisWeek)} spent over{' '}
                    {coach.pace.daysElapsedThisWeek} day
                    {coach.pace.daysElapsedThisWeek === 1 ? '' : 's'} · ~
                    {formatCurrency(coach.pace.dailySpendRate)}/day
                  </p>
                </div>
              )}

              {coach?.bills?.next14 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-fg">Bills in the next 14 days</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {coach.bills.next14.billCount === 0
                      ? 'No known recurring bills in the next 14 days.'
                      : `${coach.bills.next14.billCount} bill${coach.bills.next14.billCount === 1 ? '' : 's'} totaling ${formatCurrency(coach.bills.next14.totalAmount)}`}
                    {coach.bills.next30
                      ? ` · ${formatCurrency(coach.bills.next30.totalAmount)} over 30 days`
                      : ''}
                  </p>
                  {coach.bills.upcoming?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-fg-subtle">
                      {coach.bills.upcoming.map((bill) => (
                        <li key={`${bill.merchant}-${bill.date}`}>
                          {bill.date}: {bill.merchant} — {formatCurrency(bill.amount)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <HowCalculatedDisclosure
                title="How we decide Fine / Tight / At risk"
                items={[
                  'We compare what’s left after known bills to this week’s daily spend pace until payday.',
                  'Pace = spending so far this week ÷ days elapsed (Mon–today).',
                  'Bill lists use the same recurring charges as your forecast (next 14 and 30 days).',
                ]}
              />
            </section>

            {/* R4 Payday edit */}
            <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                    Payday
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {data.payday?.configured
                      ? `${formatPayCadence(data.payday.payCadence)} · next ${data.payday.nextPaydayOn}`
                      : 'Not set — confirm so we can show what’s left until payday.'}
                  </p>
                </div>
                {data.payday?.configured && !editingPayday && (
                  <button
                    type="button"
                    onClick={() => setEditingPayday(true)}
                    className="text-xs font-semibold text-ai-soft hover:underline"
                  >
                    Edit payday
                  </button>
                )}
              </div>

              {(editingPayday || !data.payday?.configured) && (
                <div className="mt-4 space-y-3">
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saveMutation.isPending || !nextPaydayOn}
                      onClick={() => saveMutation.mutate()}
                      className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand-soft disabled:opacity-60"
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save payday'}
                    </button>
                    {data.payday?.configured && (
                      <button
                        type="button"
                        onClick={() => setEditingPayday(false)}
                        className="text-sm text-fg-muted hover:text-fg"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section
              className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left"
              aria-labelledby="how-you-did-heading"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                How you did
              </p>
              <h2 id="how-you-did-heading" className="mt-2 text-lg font-semibold text-fg">
                This week’s spend
              </h2>
              <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-fg">
                {formatCurrency(data.howYouDid?.spentThisWeek)}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">
                {data.howYouDid?.summary}
              </p>
            </section>

            <section
              className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left"
              aria-labelledby="whats-left-heading"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                What’s left
              </p>
              <h2 id="whats-left-heading" className="mt-2 text-lg font-semibold text-fg">
                Until payday
              </h2>
              {data.whatsLeft?.configured ? (
                <>
                  <p className="mt-3 font-mono text-3xl font-semibold tabular-nums text-brand-soft">
                    {formatCurrency(data.whatsLeft.amount)}
                  </p>
                  <p className="mt-2 text-sm text-fg-muted">
                    {data.whatsLeft.daysUntilPayday === 0
                      ? 'Payday is today'
                      : `${data.whatsLeft.daysUntilPayday} day${data.whatsLeft.daysUntilPayday === 1 ? '' : 's'} until ${data.whatsLeft.nextPaydayOn}`}
                    {data.whatsLeft.billsUntilPaydayTotal > 0
                      ? ` · ${formatCurrency(data.whatsLeft.billsUntilPaydayTotal)} in known bills`
                      : ' · no known bills before payday'}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-fg-muted">
                  Save payday above to unlock what’s left after bills.
                </p>
              )}
            </section>

            <section
              className={`rounded-xl border px-5 py-5 text-left ${toneClasses(data.risk?.tone)}`}
              aria-labelledby="one-risk-heading"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                One risk
              </p>
              <h2 id="one-risk-heading" className="mt-2 text-lg font-semibold text-fg">
                {data.risk?.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{data.risk?.detail}</p>
            </section>

            <BillDefenseSection
              findings={data.billDefense ?? []}
              weekStartOn={data.week?.weekStartIso}
              invalidateKeys={[weeklyReviewQueryKey]}
              emptyMessage="No subscription surprises this week. We’ll flag price hikes, new charges, and possible duplicates here."
              onAskSoverm={(finding) => {
                const prompt =
                  finding.reviewPrompt || buildCancelKeepWatchPrompt(finding)
                openChat({
                  prompt,
                  suggestedPrompts: buildWeeklyReviewSuggestedPrompts(),
                  contextLabel:
                    'Using this week’s review, what’s left until payday, and your connected accounts.',
                })
              }}
            />

            {data.followUps?.length > 0 && (
              <section className="rounded-xl border border-border-default bg-surface px-5 py-5 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                  Last week’s follow-up
                </p>
                <ul className="mt-3 space-y-3">
                  {data.followUps.map((item) => (
                    <li
                      key={item.actionId}
                      className={`rounded-lg border px-3 py-3 ${toneClasses(item.tone)}`}
                    >
                      <p className="text-sm font-semibold text-fg">{item.summary}</p>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {formatActionStatus(item.status)} · {item.description}
                      </p>
                      {item.stillRelevant && item.status === 'accepted' && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actionMutation.isPending}
                            onClick={() =>
                              actionMutation.mutate({ mode: 'done', followUpId: item.actionId })
                            }
                            className="rounded-md bg-brand/15 px-2.5 py-1.5 text-[11px] font-semibold text-brand-soft"
                          >
                            Mark done
                          </button>
                          <button
                            type="button"
                            disabled={actionMutation.isPending}
                            onClick={() =>
                              actionMutation.mutate({
                                mode: 'still-relevant-skip',
                                followUpId: item.actionId,
                              })
                            }
                            className="text-[11px] font-semibold text-fg-muted hover:text-fg"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section
              className="rounded-xl border border-ai/30 bg-ai/10 px-5 py-5 text-left"
              aria-labelledby="one-move-heading"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ai-soft">
                One better move
              </p>
              <h2 id="one-move-heading" className="mt-2 text-lg font-semibold text-fg">
                {data.move?.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{data.move?.detail}</p>
              <p className="mt-2 text-xs text-fg-subtle">
                Accepting logs this as your move — we’ll check in next week.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionMutation.isPending || !data.move?.title}
                  onClick={() => actionMutation.mutate({ mode: 'accept' })}
                  className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand-soft disabled:opacity-60"
                >
                  Accept this move
                </button>
                <button
                  type="button"
                  disabled={actionMutation.isPending || !data.move?.title}
                  onClick={() => actionMutation.mutate({ mode: 'skip' })}
                  className="rounded-lg border border-border-default px-4 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg disabled:opacity-60"
                >
                  Skip this week
                </button>
                {data.move?.href && data.move.href !== '/weekly-review' && (
                  <Link
                    to={data.move.href}
                    className="inline-flex rounded-lg border border-ai/40 bg-ai/20 px-4 py-2.5 text-sm font-semibold text-ai transition hover:bg-ai/30"
                  >
                    {data.move.actionLabel || 'Open'}
                  </Link>
                )}
              </div>
            </section>

            <p className="pt-2 text-center text-xs text-fg-subtle">
              Week is Monday–Sunday ({data.week?.timeZone || 'app timezone'})
              {isFetching ? ' · refreshing…' : ''}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default WeeklyReviewPage

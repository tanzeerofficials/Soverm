/*
 * LANDING WEEKLY PREVIEW
 *
 * Sample "Your week" truth letter — ICP product, not a generic insight card.
 */

import { useInView } from '../hooks/useInView.js'

const SAMPLE = {
  weekLabel: 'Jul 6–12',
  whatsLeft: '$186',
  days: '4 days to payday',
  risk: 'Dining is up vs last week — and a rent-sized bill hits Thursday.',
  move: 'Cook twice this week and skip one delivery order (~$40 back).',
  grade: 'Tight',
}

function LandingInsightPreview() {
  const [ref, inView] = useInView({ threshold: 0.2 })

  return (
    <section className="mx-auto mt-20 max-w-4xl" aria-labelledby="preview-heading" ref={ref}>
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">The weekly loop</p>
        <h2 id="preview-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          One screen: how you did, what&apos;s left, one move
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
          Plus a month-end accountant letter when the calendar closes — so you always know your
          condition, not just your transactions.
        </p>
      </div>

      <div
        className={`relative mt-10 transition-all duration-700 ease-out ${
          inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <article className="overflow-hidden rounded-xl border border-border-default border-l-4 border-l-brand bg-surface shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-app/50 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-soft">
              Your week · {SAMPLE.weekLabel}
            </span>
            <span className="rounded-full border border-border-default bg-surface-elevated px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
              Sample · fictional data
            </span>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                What&apos;s left until payday
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-brand-soft">
                {SAMPLE.whatsLeft}
              </p>
              <p className="mt-1 text-sm text-fg-muted">{SAMPLE.days}</p>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                One risk
              </p>
              <p className="mt-1 text-sm text-fg">{SAMPLE.risk}</p>
            </div>

            <div className="rounded-lg border border-ai/30 bg-ai/10 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ai-soft">
                One better move
              </p>
              <p className="mt-1 text-sm text-fg">{SAMPLE.move}</p>
            </div>

            <p className="text-xs text-fg-subtle">
              Month letter so far:{' '}
              <span className="font-semibold text-fg">{SAMPLE.grade}</span>
              <span className="text-fg-muted">
                {' '}
                — Stable means cushion, Tight means little room, At risk means bills may outpace
                income.
              </span>
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}

export default LandingInsightPreview

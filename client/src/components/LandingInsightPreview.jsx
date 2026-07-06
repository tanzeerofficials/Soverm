/*
 * LANDING INSIGHT PREVIEW
 *
 * Animated sample insight so visitors see the product before signing up.
 * Uses fictional numbers — labeled clearly as a sample, not a real user.
 */

import HeadlineTypeBadge from './HeadlineTypeBadge.jsx'
import { useInView } from '../hooks/useInView.js'
import { useTypewriter } from '../hooks/useTypewriter.js'

const SAMPLE_INSIGHT = {
  headline: "Dining out is quietly eating 28% of your take-home pay",
  stats: [
    { label: 'Dining spend', value: '$892', detail: 'Restaurants & delivery this month' },
    { label: 'Cash runway', value: '12 days', detail: 'At your current burn rate' },
    { label: 'Liquid cash', value: '$2,140', detail: 'Across checking accounts' },
  ],
  summary:
    'You earned $3,200 this month but spent $3,480 — the gap is almost entirely discretionary dining. Your checking balance can cover about twelve more days at this pace before you need to transfer from savings.',
  actions: [
    'Cap dining at $400 for the next 4 weeks',
    'Move $500 to savings on payday',
    'Review subscriptions over $15/mo',
  ],
}

function staggerClass(visible, delayMs) {
  return `transition-all duration-700 ease-out ${
    visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
  }`
}

function LandingInsightPreview() {
  const [ref, inView] = useInView({ threshold: 0.2 })
  const typedHeadline = useTypewriter(SAMPLE_INSIGHT.headline, inView)
  const { stats, summary, actions } = SAMPLE_INSIGHT

  return (
    <section className="mx-auto mt-20 max-w-4xl" aria-labelledby="preview-heading" ref={ref}>
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ai">See what you get</p>
        <h2 id="preview-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Plain English, not another spreadsheet
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
          No charts to decode. Soverm reads your transactions and provides insights on what
          matters and what to prioritize — with specific numbers and next steps.
        </p>
      </div>

      <div className="relative mt-10">
        <div
          className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.12)_0%,_transparent_70%)]"
          aria-hidden="true"
        />

        <article className="relative overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-app/50 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ai">
              Soverm Insight
            </span>
            <span className="rounded-full border border-border-default bg-surface-elevated px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
              Sample · fictional data
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <div
              className={staggerClass(inView, 0)}
              style={{ transitionDelay: '120ms' }}
            >
              <HeadlineTypeBadge variant="warning" className="mb-3" />
              <h3 className="min-h-[3.5rem] text-lg font-bold leading-snug text-warning sm:text-xl">
                {typedHeadline}
                {inView && typedHeadline.length < SAMPLE_INSIGHT.headline.length && (
                  <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-warning align-middle" />
                )}
              </h3>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map(({ label, value, detail }, index) => (
                <div
                  key={label}
                  className={`rounded-lg border border-border-default bg-app px-4 py-3 ${staggerClass(inView)}`}
                  style={{ transitionDelay: `${240 + index * 120}ms` }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-fg">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">{detail}</p>
                </div>
              ))}
            </div>

            <p
              className={`mt-5 text-sm leading-relaxed text-fg-muted ${staggerClass(inView)}`}
              style={{ transitionDelay: '620ms' }}
            >
              {summary}
            </p>

            <div
              className={staggerClass(inView)}
              style={{ transitionDelay: '760ms' }}
            >
              <p className="mt-5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Your next moves
              </p>
              <ul className="mt-2 space-y-2">
                {actions.map((action, index) => (
                  <li
                    key={action}
                    className={`flex items-start gap-2 text-sm text-fg ${staggerClass(inView)}`}
                    style={{ transitionDelay: `${860 + index * 100}ms` }}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand/40 text-[10px] text-brand-soft">
                      ✓
                    </span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default LandingInsightPreview

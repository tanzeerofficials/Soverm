/*
 * LANDING COMPOUND SECTION — weekly → month letter compounding
 */

const TIMELINE = [
  {
    phase: 'This week',
    title: 'Check in once',
    body: 'See how you did, what’s left until payday, and take one better move — then get on with your life.',
  },
  {
    phase: 'This month',
    title: 'Accountant letter',
    body: 'At month-end (or anytime so far): Stable / Tight / At risk, with drivers and a plan for next month.',
  },
  {
    phase: 'Over time',
    title: 'Memory that compounds',
    body: 'Payday, category caps, and past actions stick — so Ask Soverm sounds like someone who already knows your week.',
  },
]

function LandingCompoundSection() {
  return (
    <section className="mx-auto mt-24 max-w-4xl" aria-labelledby="compound-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Built for the loop</p>
        <h2 id="compound-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Week in, month out — not a one-time report
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
          The habit is the product. Charts and chat support it; they don&apos;t replace it.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TIMELINE.map(({ phase, title, body }) => (
          <article
            key={phase}
            className="flex flex-col rounded-xl border border-border-default bg-surface p-6 text-left transition hover:border-border-hover hover:bg-surface-elevated/40"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-soft">
              {phase}
            </span>
            <h3 className="mt-3 font-semibold text-fg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default LandingCompoundSection

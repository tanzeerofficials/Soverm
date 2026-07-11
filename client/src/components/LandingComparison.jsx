/*
 * LANDING COMPARISON (G2)
 *
 * Own remaining-money coaching + weekly ritual + month-end condition
 * vs Rocket Money, bank apps, and spreadsheets.
 */

const COLUMNS = [
  {
    id: 'others',
    title: 'Rocket Money / bank apps / sheets',
    tone: 'without',
    items: [
      'Cancel subscriptions — then leave you alone',
      'Balances and charts without “what’s left until payday”',
      'No weekly ritual that ends in one clear move',
      'Month-end is a statement PDF, not a condition letter',
      'You still do the coaching in your head',
    ],
  },
  {
    id: 'soverm',
    title: 'With Soverm',
    tone: 'with',
    items: [
      'What’s left until payday after known bills',
      'Weekly check-in: how you did, one risk, one move',
      'Month-end accountant letter (Stable / Tight / At risk)',
      'Optional “Can I afford it?” check when you’re unsure',
      'Bill defense + optional category caps that feed the same loop',
    ],
  },
]

function ComparisonColumn({ title, items, tone }) {
  const isPositive = tone === 'with'

  return (
    <article
      className={`flex flex-col rounded-xl border p-6 sm:p-7 ${
        isPositive
          ? 'border-brand/40 bg-brand/5 shadow-[0_0_32px_rgba(16,185,129,0.08)]'
          : 'border-border-default bg-surface'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isPositive ? 'text-brand-soft' : 'text-fg-subtle'
        }`}
      >
        {title}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
            {isPositive ? (
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            ) : (
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-border-default text-fg-subtle">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
            <span className={isPositive ? 'text-fg' : 'text-fg-muted'}>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

function LandingComparison() {
  return (
    <section className="mx-auto mt-24 max-w-4xl" aria-labelledby="comparison-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Why Soverm</p>
        <h2 id="comparison-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Not another cancel-subs or chart app
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
          We own remaining-money coaching, the weekly ritual, and the month-end condition letter.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {COLUMNS.map((column) => (
          <ComparisonColumn
            key={column.id}
            title={column.title}
            items={column.items}
            tone={column.tone}
          />
        ))}
      </div>
    </section>
  )
}

export default LandingComparison

/*
 * LANDING COMPOUND SECTION
 *
 * Timeline showing how Soverm's value grows over time — sits between the
 * sample insight preview and the spreadsheets comparison on the landing page.
 */

const TIMELINE = [
  {
    phase: 'Phase 1',
    title: 'Connect and get clarity',
    body: 'Your first insight lands within minutes — what you spent, where it went, and what to do about it.',
    icon: (
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm0 5v6a2 2 0 002 2h12a2 2 0 002-2V9H4zm3 11a1 1 0 100-2h6a1 1 0 100 2H7z"
        clipRule="evenodd"
      />
    ),
  },
  {
    phase: 'Phase 2',
    title: 'Patterns start to emerge',
    body: 'Soverm spots recurring charges, seasonal spikes, and categories quietly draining your account.',
    icon: (
      <path
        fillRule="evenodd"
        d="M3 3a1 1 0 000 2v11a2 2 0 002 2h10a2 2 0 002-2V5a1 1 0 100-2H3zm12.707 3.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    ),
  },
  {
    phase: 'Phase 3',
    title: 'Your financial baseline',
    body: "Benchmarks built entirely on your own history. Advice that knows what's normal for you — not the average person.",
    icon: (
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    ),
  },
]

function LandingCompoundSection() {
  return (
    <section className="mx-auto mt-24 max-w-4xl" aria-labelledby="compound-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          Built to compound
        </p>
        <h2 id="compound-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Most apps show you data. Soverm builds your financial story.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-fg-muted">
          The longer you use it, the more it knows — and the sharper the advice gets.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TIMELINE.map(({ phase, title, body, icon }) => (
          <article
            key={phase}
            className="flex flex-col rounded-xl border border-border-default bg-surface p-6 text-left transition hover:border-border-hover hover:bg-surface-elevated/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-brand/40 bg-brand/10 text-brand-soft">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  {icon}
                </svg>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-soft">
                {phase}
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-fg">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default LandingCompoundSection

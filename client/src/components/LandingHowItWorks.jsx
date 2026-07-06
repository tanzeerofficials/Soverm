/*
 * LANDING HOW IT WORKS
 *
 * Three equal-height step cards explaining the connect → analyze → insight flow.
 */

const STEPS = [
  {
    step: '1',
    title: 'Connect your bank',
    description:
      'Link through Plaid in under a minute — the same secure technology used by Venmo, Coinbase, and major banks.',
  },
  {
    step: '2',
    title: 'Soverm reads your activity',
    description:
      'Every transaction and balance is analyzed for patterns — not just what you have, but where money is actually going.',
  },
  {
    step: '3',
    title: 'Get honest, specific advice',
    description:
      'A plain-English insight with real numbers, risks, and three concrete actions you can take this week.',
  },
]

function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-5xl"
      aria-labelledby="how-it-works-heading"
    >
      <div className="text-center">
        <h2 id="how-it-works-heading" className="text-2xl font-bold text-fg sm:text-3xl">
          How it works
        </h2>
        <p className="mt-3 text-sm text-fg-muted">
          Three steps from bank connection to actionable advice.
        </p>
      </div>

      <div className="mt-10">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch sm:gap-6">
          {STEPS.map(({ step, title, description }) => (
            <li key={step} className="min-h-0">
              <article className="flex h-full flex-col rounded-xl border border-border-default bg-surface p-6 text-left transition hover:border-[#2D3A52] hover:bg-surface-elevated/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/40 bg-brand/10 text-sm font-bold text-brand-soft">
                  {step}
                </span>
                <h3 className="mt-4 font-semibold text-fg">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">
                  {description}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default LandingHowItWorks

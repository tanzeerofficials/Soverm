/*
 * LANDING COMPARISON
 *
 * Two-column "Without Soverm / With Soverm" section on the landing page.
 * Contrasts manual spreadsheet tracking with Soverm's automated insights.
 */

const WITHOUT_ITEMS = [
  'Hours exporting CSVs and building pivot tables',
  'Charts that show numbers but not what they mean',
  'No idea which spending category is actually the problem',
  'Advice from Reddit threads, not your real data',
  'Out of date the moment you stop updating the sheet',
]

const WITH_ITEMS = [
  'Bank connected in under a minute via Plaid',
  'Plain-English insight: what matters and why',
  'Specific stats pulled from your transactions',
  'Three concrete actions tailored to your finances',
  'Always current — syncs when you connect or on schedule',
]

function ComparisonColumn({ variant, title, items }) {
  const isPositive = variant === 'with'

  return (
    <article
      className={`flex flex-col rounded-xl border p-6 sm:p-7 ${
        isPositive
          ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_32px_rgba(16,185,129,0.08)]'
          : 'border-[#1E2D45] bg-[#111827]'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isPositive ? 'text-emerald-400' : 'text-[#6B7280]'
        }`}
      >
        {title}
      </p>

      <ul className="mt-5 flex flex-1 flex-col gap-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
            {isPositive ? (
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            ) : (
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1E2D45] text-[#6B7280]">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
            <span className={isPositive ? 'text-[#F9FAFB]' : 'text-[#9CA3AF]'}>{item}</span>
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
        <p className="text-sm font-medium uppercase tracking-wide text-[#9CA3AF]">
          Why switch
        </p>
        <h2 id="comparison-heading" className="mt-2 text-2xl font-bold text-[#F9FAFB] sm:text-3xl">
          Spreadsheets vs. Soverm
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#9CA3AF]">
          You shouldn&apos;t need a finance degree to understand your own money.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <ComparisonColumn variant="without" title="Without Soverm" items={WITHOUT_ITEMS} />
        <ComparisonColumn variant="with" title="With Soverm" items={WITH_ITEMS} />
      </div>
    </section>
  )
}

export default LandingComparison

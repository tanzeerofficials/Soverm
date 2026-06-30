/*
 * LANDING INSIGHT PREVIEW
 *
 * Static mock of a Soverm AI insight so visitors see the product before signing up.
 * Uses fictional numbers — labeled clearly as a sample, not a real user.
 */

const SAMPLE_INSIGHT = {
  headline: "Dining out is quietly eating 28% of your take-home pay",
  headlineType: 'warning',
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

function LandingInsightPreview() {
  const { headline, stats, summary, actions } = SAMPLE_INSIGHT

  return (
    <section className="mx-auto mt-20 max-w-4xl" aria-labelledby="preview-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#8B5CF6]">
          See what you get
        </p>
        <h2 id="preview-heading" className="mt-2 text-2xl font-bold text-[#F9FAFB] sm:text-3xl">
          Plain English, not another spreadsheet
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#9CA3AF]">
          No charts to decode. Soverm reads your transactions and tells you what matters —
          with specific numbers and next steps.
        </p>
      </div>

      <div className="relative mt-10">
        <div
          className="pointer-events-none absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.12)_0%,_transparent_70%)]"
          aria-hidden="true"
        />

        <article className="relative overflow-hidden rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] shadow-2xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2D45] bg-[#0A0F1C]/50 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
              Soverm Insight
            </span>
            <span className="rounded-full border border-[#1E2D45] bg-[#1A2236] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#6B7280]">
              Sample · fictional data
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <h3 className="text-lg font-bold leading-snug text-[#F59E0B] sm:text-xl">
              {headline}
            </h3>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map(({ label, value, detail }) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#1E2D45] bg-[#0A0F1C] px-4 py-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold text-[#F9FAFB]">{value}</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">{detail}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-[#9CA3AF]">{summary}</p>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                Your next moves
              </p>
              <ul className="mt-2 space-y-2">
                {actions.map((action) => (
                  <li
                    key={action}
                    className="flex items-start gap-2 text-sm text-[#F9FAFB]"
                  >
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-emerald-500/40 text-[10px] text-emerald-400">
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

/*
 * INSIGHT FRESHNESS NUDGE
 *
 * Shown on the Insight tab when the latest insight is older than INSIGHT_STALE_DAYS.
 * Encourages generating a fresh summary without feeling like an error state.
 */

function InsightFreshnessNudge({ dayCount, onGenerateClick }) {
  return (
    <section
      className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-4 sm:px-5"
      aria-label="Insight freshness reminder"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">
            Your last insight was {dayCount} day{dayCount === 1 ? '' : 's'} ago
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">
            A lot may have changed — generate a fresh one to see what matters now.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerateClick}
          className="shrink-0 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-app transition hover:brightness-110"
        >
          Generate fresh insight
        </button>
      </div>
    </section>
  )
}

export default InsightFreshnessNudge

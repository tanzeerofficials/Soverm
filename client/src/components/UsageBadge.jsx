/*
 * USAGE BADGE
 *
 * Shows the free-tier countdown ("1 insight remaining today") or
 * Soverm Pro unlimited status on the dashboard.
 */

function UsageBadge({ usage }) {
  if (!usage) return null

  const { isPro, remainingToday, limit } = usage

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      {isPro ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 font-medium text-warning">
          ✦ Soverm Pro — unlimited insights
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium ${
            remainingToday > 0
              ? 'border-border-default bg-surface-elevated text-fg-muted'
              : 'border-border-default bg-surface-elevated text-fg-subtle'
          }`}
        >
          Soverm Free Tier
          {remainingToday > 0
            ? ` · ${remainingToday} of ${limit} insight${limit === 1 ? '' : 's'} left today`
            : " · Today's free insight used"}
        </span>
      )}
    </div>
  )
}

export default UsageBadge

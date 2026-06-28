/*
 * USAGE BADGE
 *
 * Shows the free-tier countdown ("1 insight remaining today") and a
 * streak indicator once someone's generated insights on 2+ consecutive
 * days. Pro users see an unlimited badge with their streak only.
 */

function UsageBadge({ usage }) {
  if (!usage) return null

  const { isPro, remainingToday, limit, streak } = usage

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      {streak >= 2 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-1 font-medium text-[#F59E0B]">
          🔥 {streak} day streak
        </span>
      )}

      {isPro ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-1 font-medium text-[#F59E0B]">
          ✦ Soverm Pro — unlimited insights
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium ${
            remainingToday > 0
              ? 'border-[#1E2D45] bg-[#1A2236] text-[#9CA3AF]'
              : 'border-[#1E2D45] bg-[#1A2236] text-[#6B7280]'
          }`}
        >
          {remainingToday > 0
            ? `${remainingToday} of ${limit} free insight${limit === 1 ? '' : 's'} left today`
            : "Today's free insight used"}
        </span>
      )}
    </div>
  )
}

export default UsageBadge

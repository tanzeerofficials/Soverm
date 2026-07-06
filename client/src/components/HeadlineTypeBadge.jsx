const BADGE_VARIANTS = {
  warning: {
    label: 'Needs attention',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  positive: {
    label: 'Good news',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  improvement: {
    label: 'Improvement',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  spike: {
    label: 'Spending spike',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  insight: {
    label: 'Insight',
    className: 'border-[#374151] bg-[#1A2236] text-[#9CA3AF]',
  },
}

function HeadlineTypeBadge({ variant = 'insight', label, className = '' }) {
  const config = BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.insight

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className} ${className}`}
    >
      {label ?? config.label}
    </span>
  )
}

export default HeadlineTypeBadge

const BADGE_VARIANTS = {
  warning: {
    label: 'Needs attention',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  positive: {
    label: 'Good news',
    className: 'border-brand/30 bg-brand/10 text-brand-soft',
  },
  improvement: {
    label: 'Improvement',
    className: 'border-brand/30 bg-brand/10 text-brand-soft',
  },
  spike: {
    label: 'Spending spike',
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  insight: {
    label: 'Insight',
    className: 'border-border-default bg-surface-elevated text-fg-muted',
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

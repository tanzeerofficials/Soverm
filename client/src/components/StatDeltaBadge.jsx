import {
  buildDeltaAriaLabel,
  DELTA_VS_LABEL,
  toneForChange,
} from '../lib/insightDisplay.js'

function StatDeltaBadge({ delta, statType = 'spending', inline = false }) {
  if (!delta || typeof delta !== 'object' || !delta.direction) {
    return null
  }

  const pillBase =
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold'
  const positiveTone = 'border-brand/30 bg-brand/15 text-brand-soft'
  const negativeTone = 'border-danger/30 bg-danger/15 text-danger'
  const neutralTone = 'border-border-default bg-surface-elevated text-fg-muted'

  const toneClasses = {
    positive: positiveTone,
    negative: negativeTone,
    neutral: neutralTone,
  }

  function pillClass(direction, isNew = false) {
    return toneClasses[toneForChange(statType, direction, isNew)]
  }

  const ariaLabel = buildDeltaAriaLabel(delta, statType)
  const wrapperClass = inline ? 'shrink-0' : 'mt-1.5'

  function renderPill(content, direction, isNew = false) {
    return (
      <div className={wrapperClass}>
        <span
          className={`${pillBase} ${pillClass(direction, isNew)}`}
          role="status"
          aria-label={ariaLabel}
        >
          {content}
        </span>
      </div>
    )
  }

  if (delta.direction === 'flat') {
    return renderPill(
      <>
        <span className="text-sm font-bold leading-none">steady</span>
        <span className="text-[11px] font-semibold leading-none opacity-90">
          {DELTA_VS_LABEL}
        </span>
      </>,
      'flat'
    )
  }

  if (delta.direction === 'down') {
    return renderPill(
      <>
        <span aria-hidden="true">↓</span>
        <span className="text-sm font-bold leading-none">{delta.percent}%</span>
        <span className="text-[11px] font-semibold leading-none opacity-90">
          {DELTA_VS_LABEL}
        </span>
      </>,
      'down'
    )
  }

  if (delta.direction === 'up') {
    if (delta.percent === null || delta.percent === undefined) {
      return renderPill(
        <>
          <span className="text-sm font-bold leading-none">new</span>
          <span className="text-[11px] font-semibold leading-none opacity-90">
            {DELTA_VS_LABEL}
          </span>
        </>,
        'up',
        true
      )
    }

    return renderPill(
      <>
        <span aria-hidden="true">↑</span>
        <span className="text-sm font-bold leading-none">{delta.percent}%</span>
        <span className="text-[11px] font-semibold leading-none opacity-90">
          {DELTA_VS_LABEL}
        </span>
      </>,
      'up'
    )
  }

  return null
}

export default StatDeltaBadge

/*
 * HISTORY INSIGHT ENTRY
 *
 * Compact, scannable row for one insight in the History timeline.
 * Full detail opens in HistoryInsightModal via onSelect.
 */

import { formatInsightDate } from '../lib/formatInsightDate.js'
import {
  buildDeltaAriaLabel,
  compactDeltaToneClass,
  formatCompactDelta,
  resolveStatType,
  selectHistoryPreviewStats,
} from '../lib/insightDisplay.js'

function entryAccent(headlineType) {
  switch (headlineType) {
    case 'warning':
      return {
        border: 'border-l-[#F59E0B]',
        icon: '⚠️',
        iconClass: 'text-[#F59E0B]',
      }
    case 'positive':
      return {
        border: 'border-l-[#10B981]',
        icon: '📈',
        iconClass: 'text-[#10B981]',
      }
    default:
      return {
        border: 'border-l-[#4B5563]',
        icon: null,
        iconClass: 'text-[#9CA3AF]',
      }
  }
}

function HistoryStatPreview({ stats }) {
  const previewStats = selectHistoryPreviewStats(stats)

  if (previewStats.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {previewStats.map((stat, index) => {
        const statType = resolveStatType(stat)
        const deltaLabel = formatCompactDelta(stat.delta)
        const deltaAriaLabel = buildDeltaAriaLabel(stat.delta, statType)

        return (
          <span key={stat.label} className="inline-flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <span className="text-[#374151]" aria-hidden="true">
                ·
              </span>
            )}
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-[#0A0F1C]/60 px-2 py-0.5 text-xs">
              <span className="truncate font-medium text-[#9CA3AF]">{stat.label}</span>
              <span className="shrink-0 font-mono font-semibold text-[#F9FAFB]">{stat.value}</span>
              {deltaLabel && (
                <span
                  className={`shrink-0 font-semibold ${compactDeltaToneClass(statType, stat.delta)}`}
                  aria-label={deltaAriaLabel}
                >
                  {deltaLabel}
                </span>
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function HistoryInsightEntry({ insight, onSelect }) {
  const { headline, headlineType, stats = [], created_at } = insight
  const { border, icon, iconClass } = entryAccent(headlineType)
  const dateLabel = formatInsightDate(created_at)

  return (
    <button
      type="button"
      onClick={() => onSelect(insight)}
      className={`group flex w-full items-center gap-3 rounded-lg border border-[#1E2D45] border-l-4 bg-[#111827] px-4 py-3 text-left transition hover:bg-[#1A2236] ${border}`}
    >
      <div className="min-w-0 flex-1">
        {dateLabel && (
          <time
            className="text-xs font-medium text-[#9CA3AF]"
            dateTime={new Date(created_at).toISOString()}
          >
            {dateLabel}
          </time>
        )}
        <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-[#F9FAFB]">
          {icon && (
            <span className={`mr-1.5 ${iconClass}`} aria-hidden="true">
              {icon}
            </span>
          )}
          {headline}
        </p>
        <HistoryStatPreview stats={stats} />
      </div>

      <span className="flex flex-shrink-0 items-center gap-1 self-center text-xs font-medium text-[#8B5CF6] transition group-hover:text-[#A78BFA]">
        View insight
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </button>
  )
}

export default HistoryInsightEntry

/*
 * HISTORY INSIGHT ENTRY
 *
 * Timeline card for one insight in the History archive.
 * Full detail opens in HistoryInsightModal via onSelect.
 */

import { format } from 'date-fns'
import HeadlineTypeBadge from './HeadlineTypeBadge.jsx'
import { formatInsightDate } from '../lib/formatInsightDate.js'
import {
  buildDeltaAriaLabel,
  compactDeltaToneClass,
  formatCompactDelta,
  resolveStatType,
  selectHistoryPreviewStats,
} from '../lib/insightDisplay.js'

function headlineBadgeVariant(headlineType) {
  switch (headlineType) {
    case 'warning':
      return 'warning'
    case 'positive':
      return 'positive'
    default:
      return 'insight'
  }
}

function headlineColorClass(headlineType) {
  switch (headlineType) {
    case 'warning':
      return 'text-warning'
    case 'positive':
      return 'text-brand-soft'
    default:
      return 'text-fg'
  }
}

function timelineDotClass(headlineType) {
  switch (headlineType) {
    case 'warning':
      return 'bg-warning ring-warning/30'
    case 'positive':
      return 'bg-brand ring-brand/30'
    default:
      return 'bg-fg-subtle ring-fg-subtle/30'
  }
}

function HistoryStatPreview({ stats }) {
  const previewStats = selectHistoryPreviewStats(stats)

  if (previewStats.length === 0) {
    return null
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {previewStats.map((stat) => {
        const statType = resolveStatType(stat)
        const deltaLabel = formatCompactDelta(stat.delta)
        const deltaAriaLabel = buildDeltaAriaLabel(stat.delta, statType)

        return (
          <span
            key={stat.label}
            className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border-default bg-app px-2.5 py-1.5 text-xs"
          >
            <span className="truncate font-medium text-fg-subtle">{stat.label}</span>
            <span className="shrink-0 font-mono font-semibold tabular-nums text-fg">
              {stat.value}
            </span>
            {deltaLabel && (
              <span
                className={`shrink-0 font-semibold tabular-nums ${compactDeltaToneClass(statType, stat.delta)}`}
                aria-label={deltaAriaLabel}
              >
                {deltaLabel}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

function HistoryInsightEntry({ insight, onSelect, showTimeline = true }) {
  const { headline, headlineType, stats = [], actions = [], created_at } = insight
  const badgeVariant = headlineBadgeVariant(headlineType)
  const headlineColor = headlineColorClass(headlineType)
  const dateLabel = formatInsightDate(created_at)
  const shortDate = created_at ? format(new Date(created_at), 'MMM d, yyyy') : null
  const completedActions = actions.filter((action) => action.completed).length

  return (
    <div className={`relative ${showTimeline ? 'pl-8' : ''}`}>
      {showTimeline && (
        <span
          className={`absolute left-0 top-7 h-3.5 w-3.5 rounded-full ring-4 ring-app ${timelineDotClass(headlineType)}`}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={() => onSelect(insight)}
        className="group flex w-full flex-col overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface text-left shadow-sm transition hover:border-border-hover hover:bg-surface-elevated/40 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-default bg-app/50 px-4 py-3 sm:px-5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ai">
            Soverm Insight
          </span>
          {dateLabel && (
            <time
              className="text-xs text-fg-muted"
              dateTime={new Date(created_at).toISOString()}
            >
              {shortDate ?? dateLabel}
            </time>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <HeadlineTypeBadge variant={badgeVariant} />
            {actions.length > 0 && (
              <span className="text-[11px] text-fg-subtle">
                {completedActions}/{actions.length} actions done
              </span>
            )}
          </div>

          <p
            className={`mt-2 line-clamp-2 text-base font-semibold leading-snug group-hover:text-fg ${headlineColor}`}
          >
            {headline}
          </p>

          <HistoryStatPreview stats={stats} />

          <div className="mt-4 flex items-center justify-between gap-3">
            {dateLabel && (
              <time
                className="text-xs text-fg-subtle sm:hidden"
                dateTime={new Date(created_at).toISOString()}
              >
                {dateLabel}
              </time>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ai-soft transition group-hover:text-ai">
              Open
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
        </div>
      </button>
    </div>
  )
}

export default HistoryInsightEntry

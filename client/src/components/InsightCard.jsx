/*
 * INSIGHT CARD
 *
 * Displays a structured AI financial insight with headline,
 * stat cards, and an expandable full summary (progressive disclosure).
 */

import { useState } from 'react'
import ActionChecklist from './ActionChecklist.jsx'
import ChatPanel from './ChatPanel.jsx'
import InsightQuickQuestions from './InsightQuickQuestions.jsx'
import StatDeltaBadge from './StatDeltaBadge.jsx'
import { buildDashboardSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'
import {
  formatInsightSnapshotFootnote,
  normalizePeriodCopy,
  resolveStatType,
} from '../lib/insightDisplay.js'

function formatTimestamp(createdAt) {
  if (!createdAt) return null
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function headlineStyles(headlineType) {
  switch (headlineType) {
    case 'warning':
      return { color: 'text-[#F59E0B]', icon: '⚠️' }
    case 'positive':
      return { color: 'text-[#10B981]', icon: '📈' }
    default:
      return { color: 'text-[#F9FAFB]', icon: null }
  }
}

function InsightCard({
  insight,
  onChatError,
  chatExpanded: controlledChatExpanded,
  onChatExpandedChange,
}) {
  const [expanded, setExpanded] = useState(false)
  const [internalChatExpanded, setInternalChatExpanded] = useState(false)
  const chatExpanded = controlledChatExpanded ?? internalChatExpanded
  const setChatExpanded = onChatExpandedChange ?? setInternalChatExpanded

  if (!insight) {
    return (
      <div className="rounded-xl border border-[#1E2D45] bg-[#111827] px-6 py-10 text-center">
        <p className="text-sm leading-relaxed text-[#9CA3AF]">
          No insight generated yet. Click Generate above to analyze your finances.
        </p>
      </div>
    )
  }

  const { headline, headlineType, stats = [], fullSummary, created_at } = insight
  const { color: headlineColor, icon: headlineIcon } = headlineStyles(headlineType)
  const timestamp = formatTimestamp(created_at)
  const snapshotFootnote = formatInsightSnapshotFootnote(insight)

  return (
    <>
      <article className="rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] p-4 transition hover:bg-[#1A2236] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
          Soverm
        </span>
        {timestamp && (
          <time className="text-xs text-[#9CA3AF]" dateTime={new Date(created_at).toISOString()}>
            {timestamp}
          </time>
        )}
      </div>

      {snapshotFootnote && (
        <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">{snapshotFootnote}</p>
      )}

      <h3 className={`mb-4 mt-4 break-words text-xl font-bold sm:text-2xl ${headlineColor}`}>
        {headlineIcon && <span className="mr-2">{headlineIcon}</span>}
        {headline}
      </h3>

      {stats.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-[#1A2236] p-4">
              <p className="text-xs uppercase text-[#9CA3AF]">{stat.label}</p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="font-mono text-xl font-bold text-[#F9FAFB]">{stat.value}</p>
                <StatDeltaBadge
                  delta={stat.delta}
                  statType={resolveStatType(stat)}
                  inline
                />
              </div>
              <p className="mt-1 text-xs text-[#9CA3AF]">{normalizePeriodCopy(stat.detail)}</p>
            </div>
          ))}
        </div>
      )}

      {fullSummary && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-4 flex items-center gap-1 text-sm text-[#8B5CF6] transition hover:underline"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            {expanded ? 'Show less' : 'Read full breakdown'}
          </button>

          {expanded && (
            <div className="mt-4 border-t border-[#1E2D45] pt-4">
              {Array.isArray(fullSummary) ? (
                fullSummary.map((paragraph, index) => (
                  <p
                    key={index}
                    className="mb-4 leading-relaxed text-[#D1D5DB] last:mb-0"
                  >
                    {normalizePeriodCopy(paragraph)}
                  </p>
                ))
              ) : (
                <p className="leading-relaxed text-[#D1D5DB]">{normalizePeriodCopy(fullSummary)}</p>
              )}
            </div>
          )}
        </>
      )}
      </article>
      {insight.actions?.length > 0 && (
        <ActionChecklist actions={insight.actions} />
      )}
      {insight.id && (
        <>
          <ChatPanel
            insightId={insight.id}
            onError={onChatError}
            expanded={chatExpanded}
            onExpandedChange={setChatExpanded}
            suggestedPrompts={buildDashboardSuggestedPrompts()}
          />
          <InsightQuickQuestions
            insightId={insight.id}
            insight={insight}
            onError={onChatError}
            onExpandChat={() => setChatExpanded(true)}
          />
        </>
      )}
    </>
  )
}

export { default as StatDeltaBadge } from './StatDeltaBadge.jsx'

export default InsightCard

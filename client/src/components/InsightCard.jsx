/*
 * INSIGHT CARD
 *
 * Displays a structured AI financial insight with headline,
 * stat cards, and an expandable full summary (progressive disclosure).
 * Ask Soverm always opens the shared ongoing FAB chat (one history).
 */

import { useState } from 'react'
import HeadlineTypeBadge from './HeadlineTypeBadge.jsx'
import ActionChecklist from './ActionChecklist.jsx'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'
import InsightQuickQuestions from './InsightQuickQuestions.jsx'
import StatDeltaBadge from './StatDeltaBadge.jsx'
import { useAskSoverm } from '../context/AskSovermContext.jsx'
import {
  formatInsightSnapshotFootnote,
  normalizePeriodCopy,
  resolveStatType,
} from '../lib/insightDisplay.js'

const INSIGHT_CHAT_CONTEXT_LABEL =
  'Your ongoing Ask Soverm chat — grounded in this check-in and your live accounts when available.'

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

function InsightCard({
  insight,
  onOpenFloatingChat = null,
  showActions = true,
}) {
  const [expanded, setExpanded] = useState(false)
  const { openChat } = useAskSoverm()

  /*
   * Opens the one shared Ask Soverm thread (FAB).
   * History used to mount a separate insight-scoped ChatPanel — users lost
   * continuity with Home. Optional onOpenFloatingChat lets parents customize;
   * otherwise we open the global chat ourselves.
   */
  function handleOpenChat(prompt = '') {
    if (typeof onOpenFloatingChat === 'function') {
      onOpenFloatingChat(prompt)
      return
    }

    openChat({
      prompt,
      autoSend: Boolean(prompt),
      contextLabel: INSIGHT_CHAT_CONTEXT_LABEL,
    })
  }

  if (!insight) {
    return (
      <div className="rounded-xl border border-border-default bg-surface px-6 py-10 text-center card-shadow">
        <p className="text-sm leading-relaxed text-fg-muted">
          No insight generated yet. Go to the Insight tab, sync your accounts if needed, then tap
          Generate Insights.
        </p>
      </div>
    )
  }

  const { headline, headlineType, stats = [], fullSummary, created_at } = insight
  const badgeVariant = headlineBadgeVariant(headlineType)
  const headlineColor = headlineColorClass(headlineType)
  const timestamp = formatTimestamp(created_at)
  const snapshotFootnote = formatInsightSnapshotFootnote(insight)

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface card-shadow transition hover:bg-surface-elevated/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-app/50 px-4 py-3 sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-ai">
            Soverm Insight
          </span>
          {timestamp && (
            <time className="text-xs text-fg-muted" dateTime={new Date(created_at).toISOString()}>
              {timestamp}
            </time>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {snapshotFootnote && (
            <p className="text-xs leading-relaxed text-fg-subtle">{snapshotFootnote}</p>
          )}

          <div className={`space-y-3 ${snapshotFootnote ? 'mt-3' : ''}`}>
            <HeadlineTypeBadge variant={badgeVariant} />
            <h3 className={`break-words text-xl font-bold sm:text-2xl ${headlineColor}`}>
              {headline}
            </h3>
          </div>

          {stats.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border-default bg-app px-4 py-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                    {stat.label}
                  </p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="font-mono text-xl font-semibold tabular-nums text-fg">
                      {stat.value}
                    </p>
                    <StatDeltaBadge
                      delta={stat.delta}
                      statType={resolveStatType(stat)}
                      inline
                    />
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {normalizePeriodCopy(stat.detail)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {fullSummary && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="mt-5 flex items-center gap-1 text-sm text-ai-soft transition hover:text-ai hover:underline"
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
                <div className="mt-4 border-t border-border-default pt-4">
                  {Array.isArray(fullSummary) ? (
                    fullSummary.map((paragraph, index) => (
                      <p
                        key={index}
                        className="mb-4 leading-relaxed text-fg-muted last:mb-0"
                      >
                        {normalizePeriodCopy(paragraph)}
                      </p>
                    ))
                  ) : (
                    <p className="leading-relaxed text-fg-muted">
                      {normalizePeriodCopy(fullSummary)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </article>
      {showActions && insight.actions?.length > 0 && (
        <ActionChecklist actions={insight.actions} />
      )}
      {insight.id && (
        <>
          <section id="insight-chat" className="mt-4 scroll-mt-28">
            <ChatWithCfoButton onClick={() => handleOpenChat()} />
          </section>
          <InsightQuickQuestions
            insight={insight}
            onAskQuestion={(question) => handleOpenChat(question)}
          />
        </>
      )}
    </>
  )
}

export { default as StatDeltaBadge } from './StatDeltaBadge.jsx'

export default InsightCard

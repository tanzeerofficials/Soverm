import { useState } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from './Skeleton.jsx'
import ChatPanel from './ChatPanel.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'
import {
  formatCurrency,
  formatGeneratedAt,
  useExpenseAnalyzerNarrative,
} from '../lib/useExpenseAnalyzerNarrative.js'

function ExpenseAnalyzerNarrativeSection({
  templateSummary,
  narrativeMeta,
  totalRecurringMonthly,
  latestInsightId,
}) {
  const [chatExpanded, setChatExpanded] = useState(false)
  const fingerprint = narrativeMeta?.fingerprint
  const confirmedRecurring =
    narrativeMeta?.confirmedRecurringMonthly ?? totalRecurringMonthly ?? 0

  const {
    personalNarrative,
    showPersonalized,
    templateSummary: resolvedTemplate,
    generatePersonalized,
    isGenerating,
    generationError,
    awaitingCacheCheck,
  } = useExpenseAnalyzerNarrative({
    fingerprint,
    templateSummary,
    enabled: Boolean(fingerprint),
  })

  const displayTemplate = resolvedTemplate ?? templateSummary
  const generatedLabel = formatGeneratedAt(personalNarrative?.generatedAt)
  const hasNarrativeContent =
    showPersonalized || displayTemplate || awaitingCacheCheck || isGenerating

  if (!hasNarrativeContent && !fingerprint) {
    return null
  }

  return (
    <section
      className="rounded-xl border border-[#1E2D45] bg-[#111827]"
      aria-label="AI spending narrative"
    >
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#6B7280]">
              AI narrative
            </p>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              {showPersonalized
                ? 'Soverm’s read of your spending, last 30 days'
                : 'From your synced transactions — get a personalized read below'}
            </p>
          </div>

          {showPersonalized ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Personalized
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {awaitingCacheCheck || isGenerating ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading narrative">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : showPersonalized ? (
            <div className="space-y-3">
              <p className="text-base font-semibold leading-snug text-[#F9FAFB]">
                {personalNarrative.lead}
              </p>
              {personalNarrative.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-[#D1D5DB]">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-[#D1D5DB]">{displayTemplate}</p>
          )}
        </div>

        {confirmedRecurring > 0 && (
          <p className="mt-4 text-sm text-[#9CA3AF]">
            Recurring{' '}
            <span className="font-mono font-semibold tabular-nums text-[#C4B5FD]">
              {formatCurrency(confirmedRecurring)}/mo
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2D45] pt-4">
          <p className="text-xs text-[#6B7280]">
            {showPersonalized && generatedLabel
              ? `Generated ${generatedLabel}`
              : 'Posted transactions only'}
          </p>

          <div className="flex flex-col items-end gap-2">
            {!showPersonalized && (
              <button
                type="button"
                onClick={generatePersonalized}
                disabled={isGenerating || !fingerprint}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Preparing your read…' : 'Get your AI read'}
              </button>
            )}

            {generationError && (
              <p className="max-w-xs text-right text-xs leading-relaxed text-amber-200/90">
                {generationError.message ||
                  'Couldn’t generate your read right now. The breakdown below is still accurate.'}
              </p>
            )}

            {showPersonalized && displayTemplate && (
              <details className="text-sm">
                <summary className="cursor-pointer list-none text-[#9CA3AF] transition hover:text-white">
                  View standard summary
                </summary>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-[#9CA3AF]">
                  {displayTemplate}
                </p>
              </details>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-[#1E2D45] pt-5">
          <div className="mb-3 flex items-center gap-2">
            <ChatBubbleIcon className="h-4 w-4 text-[#8B5CF6]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8B5CF6]">
              Ask Soverm
            </h3>
          </div>

          {latestInsightId ? (
            <ChatPanel
              insightId={latestInsightId}
              expanded={chatExpanded}
              onExpandedChange={setChatExpanded}
            />
          ) : (
            <div className="rounded-lg border border-[#1E2D45] bg-[#0A0F1C]/40 px-4 py-4">
              <p className="text-sm leading-relaxed text-[#9CA3AF]">
                Generate your first insight on the{' '}
                <Link to="/dashboard" className="text-[#8B5CF6] underline-offset-2 hover:underline">
                  dashboard
                </Link>{' '}
                to ask follow-up questions about your spending.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default ExpenseAnalyzerNarrativeSection

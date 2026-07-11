import { useState } from 'react'
import Skeleton from './Skeleton.jsx'
import ChatPanel from './ChatPanel.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'
import { buildExpenseAnalyzerSuggestedPrompts } from '../lib/chatSuggestedPrompts.js'
import { GENERAL_CHAT_KEY } from '../lib/queryKeys.js'
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
  const suggestedPrompts = buildExpenseAnalyzerSuggestedPrompts({ totalRecurringMonthly })
  const hasNarrativeContent =
    showPersonalized || displayTemplate || awaitingCacheCheck || isGenerating

  if (!hasNarrativeContent && !fingerprint) {
    return null
  }

  return (
    <section
      className="rounded-xl border border-border-default bg-surface"
      aria-label="Expense analysis and summary"
    >
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fg-subtle">
              Analyze &amp; Summary
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {showPersonalized
                ? 'Soverm’s summary of your spending, last 30 days'
                : 'From your synced transactions — get a detailed expense summary below'}
            </p>
          </div>

          {showPersonalized ? (
            <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-soft">
              Your summary
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {awaitingCacheCheck || isGenerating ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading summary">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : showPersonalized ? (
            <div className="space-y-3">
              <p className="text-base font-semibold leading-snug text-fg">
                {personalNarrative.lead}
              </p>
              {personalNarrative.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="text-sm leading-relaxed text-fg-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-fg-muted">{displayTemplate}</p>
          )}
        </div>

        {confirmedRecurring > 0 && (
          <p className="mt-4 text-sm text-fg-muted">
            Recurring{' '}
            <span className="font-mono font-semibold tabular-nums text-ai-soft">
              {formatCurrency(confirmedRecurring)}/mo
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-4">
          <p className="text-xs text-fg-subtle">
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
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Preparing your summary…' : 'Get expense summary'}
              </button>
            )}

            {generationError && (
              <p className="max-w-xs text-right text-xs leading-relaxed text-warning/90">
                {generationError.message ||
                  'Couldn’t generate your summary right now. The breakdown below is still accurate.'}
              </p>
            )}

            {showPersonalized && displayTemplate && (
              <details className="text-sm">
                <summary className="cursor-pointer list-none text-fg-muted transition hover:text-fg">
                  View standard summary
                </summary>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-fg-muted">
                  {displayTemplate}
                </p>
              </details>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-border-default pt-5">
          <div className="mb-3 flex items-center gap-2">
            <ChatBubbleIcon className="h-4 w-4 text-ai" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ai">
              Ask Soverm
            </h3>
          </div>

          <ChatPanel
            threadId={latestInsightId || GENERAL_CHAT_KEY}
            insightId={latestInsightId}
            expanded={chatExpanded}
            onExpandedChange={setChatExpanded}
            suggestedPrompts={suggestedPrompts}
            contextLabel="Uses your synced transactions, recurring charges, and category breakdown."
          />
        </div>
      </div>
    </section>
  )
}

export default ExpenseAnalyzerNarrativeSection

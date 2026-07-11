/*
 * SOVERM PLAN CARDS
 *
 * Structured checklist / budget-tier UI parsed from ```soverm-plan blocks
 * in assistant replies (night-out plans, savings steps, tax how-tos).
 */

import { useState } from 'react'
import {
  copyTextToClipboard,
  formatSovermPlanText,
} from '../lib/parseSovermPlan.js'

const TONE_STYLES = {
  fine: 'border-brand/30 bg-brand/10 text-brand-soft',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  neutral: 'border-border-default bg-app/60 text-fg-muted',
}

function SovermPlanCards({ plan }) {
  const [copyState, setCopyState] = useState('idle')

  if (!plan?.cards?.length) {
    return null
  }

  async function handleCopyPlan() {
    try {
      await copyTextToClipboard(formatSovermPlanText(plan))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-ai/25 bg-app/40 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {plan.title && (
            <p className="text-xs font-semibold uppercase tracking-wide text-ai">
              {plan.title}
            </p>
          )}
          {plan.summary && (
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{plan.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopyPlan}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-ai-soft transition hover:bg-ai/10 hover:text-white"
          aria-label="Copy plan"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Failed' : 'Copy plan'}
        </button>
      </div>
      <ol className="space-y-2">
        {plan.cards.map((card, index) => (
          <li
            key={`${card.title}-${index}`}
            className={`rounded-lg border px-3 py-2 ${TONE_STYLES[card.tone] || TONE_STYLES.neutral}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg">
                  <span className="mr-1.5 text-fg-subtle">{index + 1}.</span>
                  {card.title}
                </p>
                {card.detail && (
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{card.detail}</p>
                )}
              </div>
              {(card.amount || card.label) && (
                <div className="shrink-0 text-right">
                  {card.amount && (
                    <p className="text-sm font-semibold text-fg">{card.amount}</p>
                  )}
                  {card.label && (
                    <p className="text-[10px] uppercase tracking-wide text-fg-subtle">
                      {card.label}
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default SovermPlanCards

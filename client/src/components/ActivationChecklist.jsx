/*
 * ACTIVATION CHECKLIST UI (G5)
 *
 * Dashboard card for the ICP activation path. Hides when complete.
 */

import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useState } from 'react'
import { buildActivationChecklist } from '../lib/activationChecklist.js'

function ActivationChecklist({ hasAccounts = false, paydayConfigured = false }) {
  const { userId } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const checklist = buildActivationChecklist({
    userId,
    hasAccounts,
    paydayConfigured,
  })

  if (checklist.isComplete) {
    return null
  }

  if (collapsed) {
    return (
      <section className="rounded-xl border border-border-default bg-surface px-4 py-3 card-shadow">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-fg">Get set up</p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {checklist.completedCount} of {checklist.totalCount} · Next:{' '}
              {checklist.nextStep?.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="shrink-0 rounded-lg border border-border-default bg-surface-elevated px-3 py-1.5 text-xs font-medium text-fg"
          >
            Show
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-5 text-left card-shadow"
      aria-labelledby="activation-checklist-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle">
            Setup
          </p>
          <h2 id="activation-checklist-heading" className="mt-1 text-sm font-semibold text-fg">
            Get set up for paycheck-to-paycheck
          </h2>
          <p className="mt-1 text-xs text-fg-muted">
            {checklist.completedCount} of {checklist.totalCount} complete
            {checklist.nextStep ? ` · Next: ${checklist.nextStep.title}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 text-xs text-fg-muted hover:text-fg"
        >
          Minimize
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {checklist.steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.href}
              className={`flex gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-elevated/60 ${
                step.done ? 'opacity-70' : 'ring-1 ring-brand/25'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? 'bg-brand/20 text-brand-soft'
                    : 'bg-brand text-brand-fg'
                }`}
              >
                {step.done ? '✓' : checklist.steps.indexOf(step) + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{step.title}</span>
                <span className="mt-0.5 block text-xs text-fg-muted">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default ActivationChecklist

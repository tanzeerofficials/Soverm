import { Link } from 'react-router-dom'

function DashboardOnboarding({
  hasAccounts,
  hasSynced,
  hasPayday = false,
  hasWhatsLeft = false,
  hasInsight,
  collapsed = false,
  onCollapsedChange,
}) {
  if (hasInsight && hasPayday) {
    return null
  }

  // Hide once payday + what's left are live (ICP activation), even before first insight
  if (hasAccounts && hasSynced && hasPayday && hasWhatsLeft) {
    return null
  }

  const currentStep = !hasAccounts ? 1 : !hasSynced ? 2 : !hasPayday ? 3 : 4

  const steps = [
    {
      number: 1,
      title: 'Connect your bank',
      detail: 'Link accounts securely through Plaid.',
      done: hasAccounts,
    },
    {
      number: 2,
      title: 'Sync transactions',
      detail: 'Use Sync on the dashboard to pull your latest activity.',
      done: hasSynced,
    },
    {
      number: 3,
      title: 'Confirm payday',
      detail: 'So Soverm can show what’s left until you’re paid.',
      done: hasPayday,
      href: '/settings',
      actionLabel: 'Set payday',
    },
    {
      number: 4,
      title: 'See what’s left',
      detail: 'Balance minus known bills before payday — your first clear number.',
      done: hasWhatsLeft,
      href: '/weekly-review',
      actionLabel: 'Open Your week',
    },
  ]

  const completedCount = steps.filter((step) => step.done).length
  const currentStepMeta = steps.find((step) => step.number === currentStep)

  const heading =
    currentStep === 1
      ? 'Connect your bank to get started'
      : currentStep === 3
        ? 'Confirm payday to unlock what’s left'
        : currentStep === 4
          ? 'You’re ready — check what’s left'
          : 'Get started with Soverm'

  const subheading =
    currentStep === 1
      ? 'This is the only step you need right now — Soverm can’t read your finances until a bank is linked.'
      : currentStep === 3
        ? 'Without payday, we can’t show what’s left until you’re paid.'
        : currentStep === 4
          ? 'Open Your week or the dashboard hero to see what’s left until payday.'
          : 'Follow these steps to see what’s left until payday.'

  if (collapsed) {
    return (
      <section className="rounded-xl border border-border-default bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-fg">Getting started</p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {completedCount} of 4 complete
              {currentStepMeta && !currentStepMeta.done
                ? ` · Next: ${currentStepMeta.title}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCollapsedChange?.(false)}
            className="shrink-0 rounded-lg border border-border-default bg-surface-elevated px-3 py-1.5 text-xs font-medium text-fg transition hover:border-border-hover"
          >
            Show steps
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">{heading}</h2>
          <p className="mt-1 text-sm text-fg-muted">{subheading}</p>
        </div>
        <button
          type="button"
          onClick={() => onCollapsedChange?.(true)}
          className="shrink-0 text-xs text-fg-muted transition hover:text-fg"
        >
          Minimize
        </button>
      </div>
      <ol className="mt-5 space-y-4">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep && !step.done

          return (
            <li
              key={step.number}
              className={`-mx-2 flex gap-3 rounded-lg p-2 ${
                isCurrent ? 'bg-surface-elevated ring-1 ring-brand/40' : ''
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? 'bg-brand/20 text-brand-soft'
                    : isCurrent
                      ? 'bg-brand text-slate-950'
                      : 'bg-surface-elevated text-fg-subtle'
                }`}
              >
                {step.done ? '✓' : step.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{step.title}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{step.detail}</p>
                {isCurrent && step.href && (
                  <Link
                    to={step.href}
                    className="mt-2 inline-block text-xs font-semibold text-ai-soft hover:underline"
                  >
                    {step.actionLabel || 'Continue'} →
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default DashboardOnboarding

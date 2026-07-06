function DashboardOnboarding({ hasAccounts, hasSynced, hasInsight }) {
  if (hasInsight) {
    return null
  }

  const currentStep = !hasAccounts ? 1 : !hasSynced ? 2 : 3

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
      detail: 'Pull your latest activity into Soverm.',
      done: hasSynced,
    },
    {
      number: 3,
      title: 'Generate your first insight',
      detail: 'Let Soverm analyze your finances.',
      done: false,
    },
  ]

  const heading =
    currentStep === 1
      ? 'Connect your bank to get started'
      : currentStep === 3
        ? 'You’re ready for your first insight'
        : 'Get started with Soverm'

  const subheading =
    currentStep === 1
      ? 'This is the only step you need right now — Soverm can’t read your finances until a bank is linked.'
      : currentStep === 3
        ? 'Your accounts are synced. Hit Generate Summary below to see what Soverm finds.'
        : 'Follow these steps to see your first personalized financial insight.'

  return (
    <section className="rounded-xl border border-border-default border-l-4 border-l-brand bg-surface p-6">
      <h2 className="text-sm font-semibold text-fg">{heading}</h2>
      <p className="mt-1 text-sm text-fg-muted">{subheading}</p>
      <ol className="mt-5 space-y-4">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep && !step.done

          return (
            <li
              key={step.number}
              className={`flex gap-3 rounded-lg p-2 -mx-2 ${
                isCurrent ? 'bg-surface-elevated ring-1 ring-brand/40' : ''
              }`}
            >
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? 'bg-brand text-slate-950'
                    : isCurrent
                      ? 'border border-brand bg-brand/10 text-brand-soft'
                      : 'border border-border-default bg-surface-elevated text-fg-muted'
                }`}
              >
                {step.done ? '✓' : step.number}
              </span>
              <div>
                <p
                  className={`text-sm font-medium ${
                    step.done ? 'text-fg-muted' : 'text-fg'
                  }`}
                >
                  {step.title}
                  {isCurrent && (
                    <span className="ml-2 text-xs font-normal text-brand-soft">← next</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-fg-muted">{step.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default DashboardOnboarding

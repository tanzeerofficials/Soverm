function DashboardOnboarding({ hasAccounts, hasInsight }) {
  if (hasInsight) {
    return null
  }

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
      done: hasAccounts,
    },
    {
      number: 3,
      title: 'Generate your first insight',
      detail: 'Let your AI CFO analyze your finances.',
      done: false,
    },
  ]

  return (
    <section className="rounded-xl border border-[#1E2D45] border-l-4 border-l-[#10B981] bg-[#111827] p-6">
      <h2 className="text-sm font-semibold text-[#F9FAFB]">Get started with Soverm</h2>
      <p className="mt-1 text-sm text-[#9CA3AF]">
        Follow these steps to see your first personalized financial insight.
      </p>
      <ol className="mt-5 space-y-4">
        {steps.map((step) => (
          <li key={step.number} className="flex gap-3">
            <span
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? 'bg-[#10B981] text-slate-950'
                  : 'border border-[#1E2D45] bg-[#1A2236] text-[#9CA3AF]'
              }`}
            >
              {step.done ? '✓' : step.number}
            </span>
            <div>
              <p className={`text-sm font-medium ${step.done ? 'text-[#9CA3AF]' : 'text-[#F9FAFB]'}`}>
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default DashboardOnboarding
